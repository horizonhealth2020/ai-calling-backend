// index.js

// Main Express backend:
//  - Convoso webhook -> start Morgan
//  - Simple debug/test endpoint
//  - Uses voiceGateway for outbound calls (Vapi)

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const axios = require("axios");
const { startOutboundCall } = require("./voiceGateway");
const { isMorganEnabled } = require("./morganToggle");
const { isBusinessHours } = require("./timeUtils");

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const logger = {
  error: (...args) => {
    if (LOG_LEVELS[LOG_LEVEL] >= LOG_LEVELS.error) console.error(...args);
  },
  warn: (...args) => {
    if (LOG_LEVELS[LOG_LEVEL] >= LOG_LEVELS.warn) console.warn(...args);
  },
  info: (...args) => {
    if (LOG_LEVELS[LOG_LEVEL] >= LOG_LEVELS.info) console.log(...args);
  },
  debug: (...args) => {
    if (LOG_LEVELS[LOG_LEVEL] >= LOG_LEVELS.debug) console.log(...args);
  },
};
const CONVOSO_AUTH_TOKEN = process.env.CONVOSO_AUTH_TOKEN;
const VAPI_API_KEY = process.env.VAPI_API_KEY;

// ----- MORGAN OUTBOUND QUEUE -----
const MORGAN_MAX_CONCURRENT = 3;
const MORGAN_DIAL_INTERVAL_MS = 10000; // 10 seconds
const morganQueue = [];
const morganQueuedIds = new Set();

// Morgan slot management: 1 slot per phoneNumberId (Twilio number)
const MORGAN_PHONE_NUMBER_IDS = process.env.VAPI_PHONE_NUMBER_IDS
  ? process.env.VAPI_PHONE_NUMBER_IDS.split(",").map(s => s.trim()).filter(Boolean)
  : [];

if (MORGAN_PHONE_NUMBER_IDS.length !== 3) {
  logger.warn(
    "[MorganSlots] Expected exactly 3 VAPI_PHONE_NUMBER_IDS for Morgan slots, got:",
    MORGAN_PHONE_NUMBER_IDS.length
  );
}

// Map: phoneNumberId -> { busy, callId, startedAt }
const morganSlots = new Map();
// Map: callId -> phoneNumberId
const morganCallToSlot = new Map();

for (const id of MORGAN_PHONE_NUMBER_IDS) {
  morganSlots.set(id, { busy: false, callId: null, startedAt: null });
}

function getFreeMorganSlotId() {
  for (const [id, slot] of morganSlots.entries()) {
    if (!slot.busy) return id;
  }
  return null;
}

function markMorganSlotBusy(phoneNumberId, callId) {
  const slot = morganSlots.get(phoneNumberId);
  if (!slot) return;
  slot.busy = true;
  slot.callId = callId || null;
  slot.startedAt = Date.now();
  if (callId) {
    morganCallToSlot.set(callId, phoneNumberId);
  }
}

function freeMorganSlot(phoneNumberId) {
  const slot = morganSlots.get(phoneNumberId);
  if (!slot) return false;
  if (slot.callId) {
    morganCallToSlot.delete(slot.callId);
  }
  slot.busy = false;
  slot.callId = null;
  slot.startedAt = null;
  logger.debug("[MorganSlots] Freed slot", phoneNumberId);
  return true;
}

function freeMorganSlotByCallId(callId) {
  const phoneNumberId = morganCallToSlot.get(callId);
  if (!phoneNumberId) return false;
  const slot = morganSlots.get(phoneNumberId);
  if (!slot) return false;
  slot.busy = false;
  slot.callId = null;
  slot.startedAt = null;
  morganCallToSlot.delete(callId);
  logger.debug("[MorganSlots] Freed slot", phoneNumberId, "for callId", callId);
  return true;
}

async function enqueueMorganLead(lead) {
  if (!lead || !lead.id) return;

  // In-memory dedupe
  if (morganQueuedIds.has(lead.id)) {
    logger.debug("[MorganQueue] Skipping duplicate lead", lead.id);
    return;
  }

  morganQueue.push(lead);
  morganQueuedIds.add(lead.id);

  // Persist in Convoso: mark as queued for Morgan
  if (isMorganEnabled()) {
    await enqueueConvosoUpdate(lead.id, {
      lead_id: lead.id,
      status: "MQ"
    }).catch((err) => {
      logger.error("[MorganQueue] Failed to set MQ status for", lead.id, err);
    });
  } else {
    logger?.info?.(`[Morgan] Disabled: skipping disposition for lead ${lead.id}`);
  }

  logger.debug("[MorganQueue] Enqueued lead", lead.id, "Queue length:", morganQueue.length);
}

async function getNextMorganLead() {
  const lead = morganQueue.shift();
  if (!lead) return null;

  if (lead.id) {
    morganQueuedIds.delete(lead.id);

    // Mark as moved from queue into active calling state
    if (isMorganEnabled()) {
      await enqueueConvosoUpdate(lead.id, {
        lead_id: lead.id,
        status: "MC",
      }).catch((err) => {
        logger.error("[MorganQueue] Failed to set MC status for", lead.id, err);
      });
    } else {
      logger?.info?.(`[Morgan] Disabled: skipping disposition for lead ${lead.id}`);
    }
  }

  logger.debug("[MorganQueue] Dequeued lead", lead.id, "for dialing");
  return lead;
}

// ---- Convoso helpers (use original working pattern) ----

const convosoRequestQueue = [];
let convosoQueueRunning = false;
const CONVOSO_REQUESTS_PER_SECOND = 3;
const CONVOSO_INTERVAL_MS = Math.floor(1000 / CONVOSO_REQUESTS_PER_SECOND);
const MAX_RETRIES_429 = 5;
const BASE_DELAY_MS_429 = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Generic lead update: uses GET with auth_token in query string
async function updateConvosoLead(leadIdOrPayload, fields = {}, attempt = 1) {
  if (!CONVOSO_AUTH_TOKEN) {
    throw new Error("Missing CONVOSO_AUTH_TOKEN env var");
  }

  let leadId = leadIdOrPayload;
  let payloadFields = fields;

  if (leadIdOrPayload && typeof leadIdOrPayload === "object" && !Array.isArray(leadIdOrPayload)) {
    leadId =
      leadIdOrPayload.lead_id ||
      leadIdOrPayload.leadId ||
      leadIdOrPayload.id ||
      leadIdOrPayload.leadID ||
      null;
    payloadFields = leadIdOrPayload;
  }

  if (!leadId) {
    throw new Error("leadId is required for updateConvosoLead");
  }

  const params = new URLSearchParams({
    auth_token: CONVOSO_AUTH_TOKEN,
    lead_id: String(leadId),
  });

  Object.entries(payloadFields).forEach(([key, value]) => {
    if (key === "lead_id" || key === "leadId" || key === "leadID" || key === "id") return;
    if (value === undefined || value === null) return;
    params.append(key, String(value));
  });

  const url = `https://api.convoso.com/v1/leads/update?${params.toString()}`;
  const maskedParams = new URLSearchParams(params);
  maskedParams.set("auth_token", "***");
  const maskedUrl = `https://api.convoso.com/v1/leads/update?${maskedParams.toString()}`;

  try {
    const response = await axios.get(url);
    const status = payloadFields?.status ? ` to status ${payloadFields.status}` : "";
    logger.debug(`[updateConvosoLead] Updated lead ${leadId}${status}`);
    return response.data;
  } catch (err) {
    const statusCode = err?.response?.status;

    if (statusCode === 429) {
      if (attempt >= MAX_RETRIES_429) {
        logger.error(`[updateConvosoLead] 429 for lead ${leadId} after ${attempt} attempts`);
        throw new Error("Convoso lead update failed");
      }

      const delay = BASE_DELAY_MS_429 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 100);
      logger.warn(
        `[updateConvosoLead] 429 for lead ${leadId}, attempt ${attempt}, retrying in ${delay}ms`
      );
      await sleep(delay);
      return updateConvosoLead(leadId, payloadFields, attempt + 1);
    }

    logger.error(
      `[updateConvosoLead] Convoso error for lead ${leadId} (status ${statusCode || "unknown"}):`,
      err?.message || "Unknown error",
      maskedUrl
    );
    throw new Error("Convoso lead update failed");
  }
}

function enqueueConvosoUpdate(leadId, payload) {
  return new Promise((resolve, reject) => {
    convosoRequestQueue.push({ leadId, payload, resolve, reject });
    if (!convosoQueueRunning) {
      void processConvosoQueue();
    }
  });
}

async function processConvosoQueue() {
  convosoQueueRunning = true;

  while (convosoRequestQueue.length > 0) {
    const { leadId, payload, resolve, reject } = convosoRequestQueue.shift();
    try {
      const res = await updateConvosoLead(leadId, payload);
      resolve(res);
    } catch (err) {
      reject(err);
    }

    await sleep(CONVOSO_INTERVAL_MS);
  }

  convosoQueueRunning = false;
}

// "Add note" just means: update the lead's notes field
async function addLeadNote(leadId, note) {
  // ⚠️ This overwrites the Notes field in Convoso for that lead.
  return updateConvosoLead(leadId, { notes: note });
}

function normalizeConvosoNote(text, maxLen = 255) {
  if (!text) return "";

  // Collapse all whitespace (including newlines) into single spaces
  const singleLine = String(text).replace(/\s+/g, " ").trim();

  if (singleLine.length <= maxLen) return singleLine;

  // Optional: add ellipsis but stay within maxLen
  const ellipsis = "...";
  if (maxLen > ellipsis.length) {
    return singleLine.slice(0, maxLen - ellipsis.length) + ellipsis;
  }

  // Fallback if maxLen is very small
  return singleLine.slice(0, maxLen);
}

const MORGAN_LIST_IDS = [28001, 15857, 27223, 10587, 12794, 12793];

function normalizeConvosoLead(convosoLead) {
  if (!convosoLead) return null;
  const rawCalled = convosoLead.called_count;
  const callCount =
    rawCalled == null || rawCalled === ""
      ? null
      : Number(rawCalled);

  return {
    id: convosoLead.lead_id || convosoLead.id,
    list_id: convosoLead.list_id,
    first_name: convosoLead.first_name,
    last_name: convosoLead.last_name,
    phone: convosoLead.phone_number,
    phone_number: convosoLead.phone_number,
    state: convosoLead.state,
    call_count: callCount,
    member_id: convosoLead.member_id,
    Member_ID: convosoLead.Member_ID ?? convosoLead.member_id,
    raw: convosoLead,
  };
}

async function convosoSearchAllPages(basePayload, maxPages = 50) {
  const results = [];
  const lim = Number(basePayload.limit) || 200;
  let page = 0;

  while (page < maxPages) {
    const offset = page * lim;

    // Build form-encoded body matching Convoso's working example
    const body = new URLSearchParams({
      auth_token: basePayload.auth_token || "",
      lead_id: basePayload.lead_id || "",
      list_id: Array.isArray(basePayload.list_id)
        ? basePayload.list_id.join(",")
        : (basePayload.list_id != null ? String(basePayload.list_id) : ""),
      user_id: basePayload.user_id || "",
      status: basePayload.status || "",
      offset: String(offset),
      limit: String(lim),
      created_by: basePayload.created_by || "",
      email: basePayload.email || "",
      last_modified_by: basePayload.last_modified_by || "",
      owner_id: basePayload.owner_id || "",
      first_name: basePayload.first_name || "",
      last_name: basePayload.last_name || "",
      phone_number: basePayload.phone_number || "",
      alt_phone_1: basePayload.alt_phone_1 || "",
      alt_phone_2: basePayload.alt_phone_2 || "",
      address1: basePayload.address1 || "",
      address2: basePayload.address2 || "",
      city: basePayload.city || "",
      state: basePayload.state || "",
      province: basePayload.province || "",
      postal_code: basePayload.postal_code || "",
      country: basePayload.country || "",
      gender: basePayload.gender || "",
      plan_sold: basePayload.plan_sold || "",
      member_id: basePayload.member_id || "",
      created_at_start_date: basePayload.created_at_start_date || "",
      created_at_end_date: basePayload.created_at_end_date || "",
      updated_at_start_date: basePayload.updated_at_start_date || "",
      updated_at_end_date: basePayload.updated_at_end_date || "",
      deleted_at_start: basePayload.deleted_at_start || "",
      deleted_at_end: basePayload.deleted_at_end || "",
      archived_at_start: basePayload.archived_at_start || "",
      archived_at_end: basePayload.archived_at_end || "",
      last_call_start_date: basePayload.last_call_start_date || "",
      last_call_end_date: basePayload.last_call_end_date || "",
    });

    const res = await fetch("https://api.convoso.com/v1/leads/search", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error("[convosoSearchAllPages] HTTP", res.status, text);
      throw new Error("Convoso search failed");
    }

    const data = await res.json();
    // Convoso response shape: { success, data: { offset, limit, total, entries: [...] } }
    const entries =
      (data && data.data && Array.isArray(data.data.entries) && data.data.entries) ||
      data.entries ||
      (Array.isArray(data.data) ? data.data : []) ||
      [];

    const total = Number(data?.data?.total ?? entries.length ?? 0);

    logger.debug(
      "[convosoSearchAllPages] page",
      page,
      "offset",
      offset,
      "entries:",
      entries.length,
      "total:",
      total
    );

    results.push(...entries);

    if (!entries.length || offset + entries.length >= total) {
      break;
    }

    page += 1;
  }

  logger.debug("[convosoSearchAllPages] total accumulated:", results.length);
  return results;
}

async function hydrateMorganQueueFromConvoso() {
  if (!isBusinessHours()) {
    console.log("[MorganQueue] Outside business hours; skipping hydration.");
    return;
  }
  if (!isMorganEnabled()) {
    logger?.info?.('[Morgan] Disabled: hydrateMorganQueueFromConvoso skipped');
    return;
  }

  if (!CONVOSO_AUTH_TOKEN) {
    logger.warn("[MorganQueue] Skipping hydration: missing CONVOSO_AUTH_TOKEN");
    return;
  }

  logger.info("[MorganQueue] Hydrating from Convoso MQ status (no date filter)...");

  // Reset in-memory state
  morganQueue.length = 0;
  morganQueuedIds.clear();

  try {
    // Working MQ search call
    const raw = await convosoSearchAllPages({
      auth_token: CONVOSO_AUTH_TOKEN,
      status: "MQ",
      list_id: MORGAN_LIST_IDS,
      limit: 200,
    });

    logger.debug("[MorganQueue] Raw MQ rows from Convoso:", raw.length);

    const normalized = raw
      .map(normalizeConvosoLead)
      .filter(Boolean);

    let added = 0;
    let missingPhone = 0;

    for (const lead of normalized) {
      if (!lead.id) continue;

      if (!lead.phone) {
        missingPhone++;
        continue;
      }

      if (morganQueuedIds.has(lead.id)) continue;

      morganQueue.push(lead);
      morganQueuedIds.add(lead.id);
      added++;
    }

    logger.info(
      "[MorganQueue] Hydrated queue length from MQ:",
      added,
      "Raw MQ rows:",
      raw.length,
      "Skipped missing phone:",
      missingPhone
    );

  } catch (err) {
    logger.error("[MorganQueue] Failed to hydrate from Convoso:", err);
  }
}

async function debugFetchMQLeads() {
  if (!CONVOSO_AUTH_TOKEN) {
    logger.warn("[MorganQueue] debugFetchMQLeads: missing CONVOSO_AUTH_TOKEN");
    return [];
  }

  logger.debug("[MorganQueue] DEBUG: Fetching MQ leads from Convoso...");

  try {
    const raw = await convosoSearchAllPages({
      auth_token: CONVOSO_AUTH_TOKEN,
      status: "MQ",
      list_id: MORGAN_LIST_IDS,
      limit: 200,
    });

    logger.debug("[MorganQueue] DEBUG: Raw MQ rows from Convoso:", raw.length);

    const leads = raw
      .map(normalizeConvosoLead)
      .filter(Boolean)
      .filter((l) => l.phone);

    logger.debug("[MorganQueue] DEBUG: MQ leads with phone after normalize:", leads.length);

    // Log a small sample of lead_ids + list_id + phone for verification
    const sample = leads.slice(0, 10).map((l) => ({
      id: l.id,
      list_id: l.list_id,
      phone: l.phone,
      status: l.raw?.status || l.raw?.status_name || null,
    }));

    logger.debug("[MorganQueue] DEBUG: MQ sample:", sample);

    return leads;
  } catch (err) {
    logger.error("[MorganQueue] DEBUG: Failed to fetch MQ leads from Convoso:", err);
    return [];
  }
}

async function debugFetchMQRaw() {
  if (!CONVOSO_AUTH_TOKEN) {
    logger.warn("[MorganQueue] debugFetchMQRaw: missing CONVOSO_AUTH_TOKEN");
    return [];
  }

  logger.debug("[MorganQueue] DEBUG RAW: Fetching MQ leads from Convoso...");

  try {
    const raw = await convosoSearchAllPages({
      auth_token: CONVOSO_AUTH_TOKEN,
      status: "MQ",
      list_id: MORGAN_LIST_IDS,
      limit: 200,
    });

    logger.debug("[MorganQueue] DEBUG RAW: Raw MQ rows from Convoso:", raw.length);

    // Map to a light-weight view so I can inspect fields
    const mapped = (raw || []).map((r) => ({
      lead_id: r.lead_id || r.id,
      list_id: r.list_id,
      status: r.status || r.status_name || null,
      phone_number: r.phone_number || r.phone || null,
      member_id: r.member_id || r.Member_ID || null,
    }));

    const sample = mapped.slice(0, 20);
    logger.debug("[MorganQueue] DEBUG RAW: MQ sample:", sample);

    return mapped;
  } catch (err) {
    logger.error("[MorganQueue] DEBUG RAW: Failed to fetch MQ leads from Convoso:", err);
    return [];
  }
}

async function mergeMorganQueueFromMQ() {
  if (!isBusinessHours()) {
    console.log("[MorganQueue] Outside business hours; skipping hydration.");
    return;
  }
  if (!isMorganEnabled()) {
    logger?.info?.('[Morgan] Disabled: mergeMorganQueueFromMQ skipped');
    return;
  }

  if (!CONVOSO_AUTH_TOKEN) {
    logger.warn("[MorganQueue] Skipping MQ merge: missing CONVOSO_AUTH_TOKEN");
    return;
  }

  logger.info("[MorganQueue] Merging MQ leads from Convoso...");

  try {
    const raw = await convosoSearchAllPages({
      auth_token: CONVOSO_AUTH_TOKEN,
      status: "MQ",
      list_id: MORGAN_LIST_IDS,
      limit: 200,
    });

    let added = 0;

    const leads = raw
      .map(normalizeConvosoLead)
      .filter(Boolean)
      .filter((lead) => lead.phone);

    for (const lead of leads) {
      if (!lead || !lead.id) continue;
      if (morganQueuedIds.has(lead.id)) continue;

      morganQueue.push(lead);
      morganQueuedIds.add(lead.id);
      added += 1;
    }

    logger.info(
      `[MorganQueue] MQ merge complete. Added ${added} leads. Queue length: ${morganQueue.length}`
    );
  } catch (err) {
    logger.error("[MorganQueue] Failed to merge MQ leads from Convoso:", err);
  }
}

// TZ formatting to "YYYY-MM-DD HH:mm:ss"
function formatConvosoDateTimeInTZ(date, timeZone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

// Midnight→23:59:59 window for a day N days back in a TZ (DST safe)
function getDayWindowStrings(timeZone = "America/New_York", daysBack = 0) {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = +ymd.find((p) => p.type === "year").value;
  const m = +ymd.find((p) => p.type === "month").value;
  const d = +ymd.find((p) => p.type === "day").value;
  // anchor at noon UTC to avoid TZ edge cases, then move daysBack
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  noonUTC.setUTCDate(noonUTC.getUTCDate() - daysBack);
  const tgt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(noonUTC);
  const Y = tgt.find((p) => p.type === "year").value;
  const M = tgt.find((p) => p.type === "month").value;
  const D = tgt.find((p) => p.type === "day").value;
  return { start: `${Y}-${M}-${D} 00:00:00`, end: `${Y}-${M}-${D} 23:59:59` };
}

// One-page form-encoded POST for a single list
async function convosoSearchPage({ authToken, listId, startStr, endStr, offset = 0, limit = 2000 }) {
  const body = new URLSearchParams({
    auth_token: authToken,
    list_id: String(listId),
    created_at_start_date: startStr,
    created_at_end_date: endStr,
    offset: String(offset),
    limit: String(limit), // API max 2000
  });

  const res = await fetch("https://api.convoso.com/v1/leads/search", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error("[convosoSearchPage] HTTP", res.status, text);
    throw new Error("Convoso search failed");
  }
  const data = await res.json();
  const entries = data?.data?.entries || data?.entries || data?.data || [];
  const total = Number(data?.data?.total ?? entries.length ?? 0);
  return { entries, total };
}

// Fetch ALL rows for a window across ALL lists, paging by offset
async function convosoSearchAllListsByCreated({ authToken, listIds, startStr, endStr }) {
  const out = [];
  for (const listId of listIds) {
    let offset = 0;
    const limit = 2000;
    while (true) {
      const { entries, total } = await convosoSearchPage({
        authToken,
        listId,
        startStr,
        endStr,
        offset,
        limit,
      });
      out.push(...entries);
      if (!entries.length || offset + entries.length >= total) break;
      offset += entries.length;
    }
  }
  return out;
}

// Helper for Member_ID emptiness (handles common shapes)
function hasEmptyMemberId(obj) {
  const v = obj?.member_id ?? obj?.Member_ID ?? obj?.memberId ?? obj?.memberID;
  return v === "" || v == null;
}

// Pull Call Nows — created_at = TODAY (keep Node-side Member_ID rule)
async function findLeadsForMorganByCallCount({ limit = 50, timezone = "America/New_York" } = {}) {
  if (!CONVOSO_AUTH_TOKEN) throw new Error("Missing CONVOSO_AUTH_TOKEN env var");

  const { start, end } = getDayWindowStrings(timezone, 0);
  console.log("[Morgan/pull-leads] created_at window:", { start, end, tz: timezone });

  // Fetch everything in the window across lists; API uses form-encoded fields
  const raw = await convosoSearchAllListsByCreated({
    authToken: CONVOSO_AUTH_TOKEN,
    listIds: MORGAN_LIST_IDS,
    startStr: start,
    endStr: end,
  });
  console.log("[Morgan/pull-leads] raw rows:", raw.length);

  // Apply business rules in Node (reliable handling of empty/null Member_ID)
  let rows = raw.filter(
    (r) =>
      r.status !== "MC" &&
      r.status_name !== "MC" &&
      r.status !== "MQ" &&
      r.status_name !== "MQ"
  );

  // Apply business rules in Node (reliable handling of empty/null Member_ID)
  rows = rows.filter(hasEmptyMemberId);

  rows = rows
    .map(normalizeConvosoLead)
    .filter(Boolean)
    .filter((r) => typeof r.call_count === "number" && (r.call_count === 2 || r.call_count === 5));

  const leads = rows.filter((l) => l.phone);

  const final = leads.slice(0, Number(limit) || 50); // keep route's limit behavior
  console.log("[Morgan/pull-leads] final:", { filtered: leads.length, returned: final.length });
  return final;
}

// Pull Yesterday — created_at = PRIOR WORKING DAY (Mon→Fri, else→yesterday)
async function findYesterdayNonSaleLeads({ timezone = "America/New_York" } = {}) {
  if (!CONVOSO_AUTH_TOKEN) throw new Error("Missing CONVOSO_AUTH_TOKEN env var");

  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(
    new Date()
  );
  const daysBack = weekday === "Mon" ? 3 : 1;
  const { start, end } = getDayWindowStrings(timezone, daysBack);
  console.log("[Morgan/pull-yesterday] created_at window:", { start, end, tz: timezone, weekday, daysBack });

  const raw = await convosoSearchAllListsByCreated({
    authToken: CONVOSO_AUTH_TOKEN,
    listIds: MORGAN_LIST_IDS,
    startStr: start,
    endStr: end,
  });
  console.log("[Morgan/pull-yesterday] raw rows:", raw.length);

  const leads = raw
    .filter(
      (r) =>
        r.status !== "MC" &&
        r.status_name !== "MC" &&
        r.status !== "MQ" &&
        r.status_name !== "MQ"
    )
    .filter(hasEmptyMemberId) // Member_ID empty/null only
    .map(normalizeConvosoLead)
    .filter(Boolean)
    .filter((l) => l.phone);

  console.log("[Morgan/pull-yesterday] final:", { filtered: leads.length });
  return leads;
}

function getTimezoneDate(timeZone) {
  return new Date(new Date().toLocaleString("en-US", { timeZone }));
}

// export not used in this file, but leaving for consistency
module.exports = { updateConvosoLead, addLeadNote };

// ----- BASIC SETUP -----
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ----- HEALTHCHECK -----
app.get("/", (req, res) => {
  res.json({ ok: true, message: "ai-calling-backend is running" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, env: "ai-calling-backend", version: "v3-voice-gateway" });
});

// ----- MORGAN JOBS -----
app.post("/jobs/morgan/pull-leads", async (req, res) => {
  try {
    if (!isBusinessHours()) {
      console.log("[MorganJobs] Outside business hours; skipping manual pull.");
      return res.json({ success: false, reason: "outside_business_hours" });
    }
    if (!isMorganEnabled()) {
      return res.json({ success: true, skipped: true, reason: 'MORGAN_ENABLED=false' });
    }

    const limit = Number(req.body?.limit) || 50;

    const leads = await findLeadsForMorganByCallCount({ limit });
    for (const lead of leads) {
      await enqueueMorganLead(lead);
    }

    return res.json({
      success: true,
      fetched: leads.length,
      queue_length: morganQueue.length,
    });
  } catch (err) {
    console.error("[/jobs/morgan/pull-leads] error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to pull leads" });
  }
});

app.post("/jobs/morgan/pull-yesterday", async (req, res) => {
  try {
    if (!isBusinessHours()) {
      console.log("[MorganJobs] Outside business hours; skipping manual pull.");
      return res.json({ success: false, reason: "outside_business_hours" });
    }
    if (!isMorganEnabled()) {
      return res.json({ success: true, skipped: true, reason: 'MORGAN_ENABLED=false' });
    }

    const timezone = req.body?.timezone || "America/New_York";

    const leads = await findYesterdayNonSaleLeads({ timezone });
    for (const lead of leads) {
      await enqueueMorganLead(lead);
    }

    return res.json({
      success: true,
      fetched: leads.length,
      queue_length: morganQueue.length,
    });
  } catch (err) {
    console.error("[/jobs/morgan/pull-yesterday] error:", err);
    res
      .status(500)
      .json({ success: false, error: err.message || "Failed to pull yesterday leads" });
  }
});

// ----- WEBHOOK: CONVOSO → MORGAN OUTBOUND -----
app.post("/webhooks/convoso/new-lead", async (req, res) => {
  try {
    if (!isMorganEnabled()) {
      return res.json({ success: true, skipped: true, reason: 'MORGAN_ENABLED=false' });
    }

    console.log("[Convoso webhook] headers:", req.headers);
    console.log("[Convoso webhook] raw body:", req.body);

    let body = req.body || {};

    if (
      (!body.phone && !body.phone_number && !body.phoneNumber) &&
      Object.keys(body).length === 1
    ) {
      const onlyKey = Object.keys(body)[0];
      if (onlyKey.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(onlyKey);
          console.log("[Convoso webhook] parsed lone JSON key:", parsed);
          body = parsed;
        } catch (e) {
          console.error("[Convoso webhook] failed to parse lone JSON key:", e);
        }
      }
    }

    if (body.params && typeof body.params === "string") {
      try {
        const parsedParams = JSON.parse(body.params);
        console.log("[Convoso webhook] parsed body.params JSON:", parsedParams);
        body = { ...body, ...parsedParams };
      } catch (e) {
        console.error("[Convoso webhook] failed to parse body.params JSON:", e);
      }
    }

    const rawPhone =
      body.phone ||
      body.phone_number ||
      body.phoneNumber ||
      body.customer_phone ||
      null;

    if (!rawPhone) {
      console.error("[Convoso webhook] Missing phone number. Body was:", body);
      return res
        .status(400)
        .json({ error: "Missing phone/phone_number in Convoso payload" });
    }

    let customerNumber = String(rawPhone).trim().replace(/\D/g, "");
    if (!customerNumber) {
      return res
        .status(400)
        .json({ error: "Phone in Convoso payload had no digits" });
    }
    if (!customerNumber.startsWith("+")) {
      customerNumber = "+1" + customerNumber;
    }

    const metadata = {
      source: "convoso",
      convosoLeadId: body.lead_id || body.id || null,
      convosoListId: body.list_id || null,
      convosoRaw: body,
    };

    console.log(
      "[Convoso webhook] starting Morgan call to:",
      customerNumber,
      "metadata:",
      metadata
    );

    const voiceResult = await startOutboundCall({
      agentType: "morgan",
      agentName: "Morgan",
      toNumber: customerNumber,
      metadata,
      callName: "Morgan Outbound Qualifier",
    });

    return res.json({
      success: true,
      provider: voiceResult.provider,
      call_id: voiceResult.callId,
    });
  } catch (err) {
    console.error("[Convoso webhook] error:", err);
    res.status(500).json({ error: "Failed to trigger Morgan outbound call" });
  }
});

// ----- DEBUG: MANUAL TEST CALL -----
app.post("/debug/test-call", async (req, res) => {
  try {
    if (!isMorganEnabled()) {
      return res.json({ success: true, skipped: true, reason: 'MORGAN_ENABLED=false' });
    }

    const { phone } = req.body || {};

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Missing 'phone'. Example: { \"phone\": \"+13055551234\" }"
      });
    }

    let customerNumber = String(phone).trim().replace(/\D/g, "");
    if (!customerNumber.startsWith("+")) {
      customerNumber = "+1" + customerNumber;
    }

    const result = await startOutboundCall({
      agentType: "morgan",
      agentName: "Morgan",
      toNumber: customerNumber,
      metadata: { source: "debug-test-call" },
      callName: "Morgan Debug Test",
    });

    return res.json({
      success: true,
      message: "Outbound call requested",
      provider: result.provider,
      call_id: result.callId,
      raw: result.raw,
    });
  } catch (err) {
    console.error("[DEBUG /debug/test-call] error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Unknown error"
    });
  }
});

app.post("/debug/hydrate-mq", async (req, res) => {
  try {
    const leads = await debugFetchMQLeads();

    // Return a lightweight debug payload
    const sample = leads.slice(0, 20).map((l) => ({
      id: l.id,
      list_id: l.list_id,
      phone: l.phone,
      status: l.raw?.status || l.raw?.status_name || null,
    }));

    return res.json({
      success: true,
      total_mq_leads_with_phone: leads.length,
      sample,
    });
  } catch (err) {
    console.error("[/debug/hydrate-mq] error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to debug fetch MQ leads",
    });
  }
});

app.post("/debug/hydrate-mq-raw", async (req, res) => {
  try {
    const mq = await debugFetchMQRaw();

    return res.json({
      success: true,
      total_mq_rows: mq.length,
      sample: mq.slice(0, 50), // capped sample
    });
  } catch (err) {
    console.error("[/debug/hydrate-mq-raw] error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to debug fetch raw MQ leads",
    });
  }
});

app.post("/webhooks/vapi", async (req, res) => {
  try {
    const body = req.body || {};
    const msg = body.message || body;
    const type = msg.type;
    const call = msg.call || body.call || {};
    const callId = call.id || msg.callId || body.callId;

    if (!callId) {
      return res.status(200).json({ ok: true });
    }

    if (type === "end-of-call-report") {
      const freed = freeMorganSlotByCallId(callId);
      console.log("[VapiWebhook] end-of-call-report for callId", callId, "freed slot:", freed);

      const metadata = call.metadata || msg.metadata || body.metadata || {};
      const leadId =
        metadata.convosoLeadId ||
        metadata.lead_id ||
        metadata.leadId ||
        call.lead_id ||
        call.leadId ||
        null;

      // Try to grab the call summary from the webhook payload
      const summary =
        (body && body.summary) ||
        (msg && msg.summary) ||
        (call && call.summary) ||
        null;

      if (leadId) {
        const idStr = String(leadId);
        console.log(
          `[MorganQueue] end-of-call-report for Convoso lead ${idStr}; leaving status as MC.`
        );

        // ✅ Post call summary as a lead note if available
        if (summary && typeof addLeadNote === "function") {
          try {
            await addLeadNote(idStr, `Morgan call summary: ${summary}`);
            console.log(
              `[MorganQueue] Posted call summary note to lead ${idStr}.`
            );
          } catch (err) {
            console.error(
              "[VapiWebhook] Failed to add call summary note for lead",
              idStr,
              err
            );
          }
        }

        // IMPORTANT: Do NOT change the Convoso status here.
        // We want the lead to remain in MC to prevent re-pulling.
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[/webhooks/vapi] error:", err);
    return res.status(200).json({ ok: true });
  }
});

// ----- MORGAN QUEUE PROCESSOR -----
async function processMorganQueueTick() {
  if (!isBusinessHours()) {
    console.log("[MorganQueue] Outside business hours; skipping tick.");
    return;
  }
  if (!isMorganEnabled()) {
    logger?.info?.('[MorganQueue] Disabled: tick skipped');
    return;
  }

  try {
    let dequeuedThisTick = 0;

    // Loop until we either run out of free slots or run out of leads
    while (true) {
      const freeSlotId = getFreeMorganSlotId();
      if (!freeSlotId) {
        // No more free slots this tick
        break;
      }

      const lead = await getNextMorganLead();
      if (!lead || !lead.phone) {
        // No more leads to dial
        break;
      }

      dequeuedThisTick += 1;
      logger.debug("[MorganQueue] Using slot", freeSlotId, "for lead", lead.id);

      try {
        const result = await startOutboundCall({
          agentType: "morgan",
          agentName: "Morgan",
          toNumber: lead.phone,
          metadata: {
            convosoLeadId: lead.id || null,
            convosoListId: lead.raw?.list_id || null,
            source: "morgan-queue",
            convosoRaw: lead.raw || null,
          },
          callName: "Morgan Outbound (Queue)",
          phoneNumberId: freeSlotId,
        });

        if (result && result.callId) {
          markMorganSlotBusy(freeSlotId, result.callId);
          logger.debug(
            "[MorganQueue] Call started with callId",
            result.callId,
            "on slot",
            freeSlotId
          );
        } else {
          logger.warn("[MorganQueue] startOutboundCall returned no callId; re-queueing lead");
          morganQueue.unshift(lead);
          if (lead.id) {
            morganQueuedIds.add(lead.id);
            if (isMorganEnabled()) {
              await enqueueConvosoUpdate(lead.id, {
                lead_id: lead.id,
                status: "MQ",
              }).catch((err) => {
                logger.error(
                  "[MorganQueue] Failed to set MQ status while re-queueing",
                  lead.id,
                  err
                );
              });
            } else {
              logger?.info?.(`[Morgan] Disabled: skipping disposition for lead ${lead.id}`);
            }
          }
          // Free the slot since call didn't actually start
          freeMorganSlot(freeSlotId);
        }
      } catch (err) {
        logger.error("[processMorganQueueTick] error starting call:", err);

        // Try to revert status to MQ so the lead is not stuck in MC
        if (isMorganEnabled()) {
          await enqueueConvosoUpdate(lead.id, {
            lead_id: lead.id,
            status: "MQ",
          }).catch((e) => {
            logger.error(
              "[processMorganQueueTick] failed to revert status to MQ for lead",
              lead.id,
              e
            );
          });
        } else {
          logger?.info?.(`[Morgan] Disabled: skipping disposition for lead ${lead.id}`);
        }

        // Re-enqueue the lead so it can be retried later
        await enqueueMorganLead(lead);

        // Free the slot on error
        freeMorganSlot(freeSlotId);
        // Continue the while loop so other free slots can still be used this tick
      }
    }

    const activeCalls = Array.from(morganSlots.values()).filter((s) => s.busy).length;
    logger.info(
      `[MorganQueue] Tick: dequeued ${dequeuedThisTick} leads, queue length ${morganQueue.length}, active calls ${activeCalls}`
    );
  } catch (err) {
    logger.error("[processMorganQueueTick] error:", err);
  }
}

setInterval(processMorganQueueTick, MORGAN_DIAL_INTERVAL_MS);

// ----- AUTO PULL MORGAN LEADS EVERY 60 SECONDS -----
async function autoPullMorganLeads() {
  if (!isBusinessHours()) {
    console.log("[AutoPullMorganLeads] Outside business hours; skipping auto-pull.");
    return;
  }
  if (!isMorganEnabled()) {
    logger?.info?.('[Morgan] Disabled: autoPullMorganLeads skipped');
    return;
  }

  try {
    const response = await fetch(`http://localhost:${PORT}/jobs/morgan/pull-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    const data = await response.json();
    console.log("[AutoPullMorganLeads] Pulled:", data.fetched, "Queue:", data.queue_length);
  } catch (err) {
    console.error("[AutoPullMorganLeads] ERROR:", err);
  }
}

setInterval(autoPullMorganLeads, 60 * 1000);

async function getVapiCall(callId) {
  if (!VAPI_API_KEY) return null;
  const resp = await fetch(`https://api.vapi.ai/call/${callId}`, {
    headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
  });
  if (!resp.ok) {
    console.error("[getVapiCall] Error fetching call", callId, resp.status);
    return null;
  }
  return resp.json();
}

setInterval(async () => {
  try {
    for (const [callId, phoneNumberId] of morganCallToSlot.entries()) {
      const slot = morganSlots.get(phoneNumberId);
      if (!slot || !slot.busy) continue;

      const data = await getVapiCall(callId);
      if (!data) continue;

      const status = data.status;
      const endedReason = data.endedReason;

      if (status === "ended" || endedReason) {
        const freed = freeMorganSlotByCallId(callId);
        console.log("[VapiPoll] Call", callId, "status:", status, "endedReason:", endedReason, "freed slot:", freed);
      }
    }
  } catch (err) {
    console.error("[VapiPoll] sweep error:", err);
  }
}, 30000);

setInterval(mergeMorganQueueFromMQ, 30 * 60 * 1000); // every 30 minutes


// --------------------------------------------------------------------------
// -------------------------- INSERTED ROUTES HERE ---------------------------
// --------------------------------------------------------------------------

// ----- TOOL: sendLeadNote -----
// Called by Vapi whenever Morgan wants to log a note for this lead.
app.post("/tools/sendLeadNote", async (req, res) => {
  try {
    const body = req.body || {};
    console.log("[sendLeadNote] incoming body:", JSON.stringify(body).slice(0, 1000));

    // 1) Try to find the Vapi "message" object if present
    const message = body.message || body || {};
    const call = message.call || body.call || {};
    const metadata = call.metadata || body.metadata || {};
    const convosoRaw = metadata.convosoRaw || {};

    // 2) Resolve lead id from multiple places
    const leadId =
      metadata.convosoLeadId ||
      convosoRaw.lead_id ||
      body.lead_id ||
      body.id ||
      null;

    if (!leadId) {
      console.error("[sendLeadNote] No lead_id available (convosoLeadId/lead_id/id all missing)");
      return res.status(200).json({
        results: [
          {
            name: "sendLeadNote",
            toolCallId: "unknown",
            result: "No lead_id available, so note was not posted to Convoso.",
          },
        ],
      });
    }

    // 3) Get tool call + args (Vapi can send toolCalls or a single toolCall)
    const toolCalls =
      message.toolCalls ||
      message.toolCallList ||
      body.toolCalls ||
      body.toolCallList ||
      [];

    const firstCall =
      (Array.isArray(toolCalls) && toolCalls[0]) ||
      body.toolCall ||
      {};

    // Raw args: may be object OR JSON string; Vapi can nest them under `function.arguments`
    let args =
      (firstCall.function && firstCall.function.arguments) ||
      firstCall.args ||
      firstCall.arguments ||
      body.args ||
      body.arguments ||
      {};

    if (typeof args === "string") {
      try {
        args = JSON.parse(args);
      } catch (e) {
        console.error("[sendLeadNote] Failed to parse args JSON string:", e);
        args = {};
      }
    }

    // 4) Try to get Morgan's note text
    let noteFromMorgan =
      body.note ||
      body.notes ||
      args.note ||
      args.notes ||
      null;

    // 5) Fallback note if Morgan didn't send any
    if (!noteFromMorgan) {
      const callerNumber =
        (call.customer && call.customer.number) ||
        convosoRaw.phone_number ||
        "Unknown number";

      const firstName = convosoRaw.first_name || "Unknown";
      const lastName = convosoRaw.last_name || "";
      const state = convosoRaw.state || "";

      const displayName =
        lastName && lastName !== "test"
          ? `${firstName} ${lastName}`
          : firstName;

      noteFromMorgan =
        `AI intake call handled by Morgan for ${displayName} (${state}), ` +
        `phone ${callerNumber}, Convoso lead_id ${leadId}. ` +
        `Call completed but no detailed summary was provided by the AI.`;

      console.warn("[sendLeadNote] No note from Morgan; using fallback note.");
    }

    // NEW: normalize + enforce 255-char limit for Convoso notes
    const noteToSend = normalizeConvosoNote(noteFromMorgan);

    console.log("[sendLeadNote] Adding note for lead:", leadId);
    console.log("[sendLeadNote] Note content:", noteToSend);

    await addLeadNote(leadId, noteToSend);

    const toolCallId = firstCall.id || body.toolCallId || "unknown";

    return res.status(200).json({
      results: [
        {
          name: "sendLeadNote",
          toolCallId,
          result: "Lead note successfully added to Convoso.",
        },
      ],
    });
  } catch (err) {
    console.error("[sendLeadNote] Unexpected error:", err);

    return res.status(200).json({
      results: [
        {
          name: "sendLeadNote",
          toolCallId: "unknown",
          error: "Unexpected error in sendLeadNote route",
        },
      ],
    });
  }
});


// --------------------------------------------------------------------------
// -------------------------- END OF INSERTED ROUTES -------------------------
// --------------------------------------------------------------------------

// ----- START SERVER -----
const server = app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  await hydrateMorganQueueFromConvoso();
});

function gracefulShutdown(signal) {
  console.log(`[${signal}] received. Shutting down server...`);

  // Stop accepting new connections and wait for existing ones to finish
  server.close((err) => {
    if (err) {
      console.error("Error while closing the server during shutdown:", err);
      process.exit(1);
    }

    console.log("HTTP server closed. Exiting process.");
    process.exit(0);
  });

  // Fallback in case server.close hangs
  setTimeout(() => {
    console.warn("Force exiting after graceful shutdown timeout.");
    process.exit(0);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
