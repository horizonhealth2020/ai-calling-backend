// index.js

// Main Express backend:
//  - Convoso webhook -> start Morgan
//  - Simple debug/test endpoint
//  - Uses voiceGateway for outbound calls (Vapi)

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { startOutboundCall } = require("./voiceGateway");
const CONVOSO_AUTH_TOKEN = process.env.CONVOSO_AUTH_TOKEN;
const VAPI_API_KEY = process.env.VAPI_API_KEY;

// ----- MORGAN OUTBOUND QUEUE -----
const MORGAN_MAX_CONCURRENT = 3;
const MORGAN_DIAL_INTERVAL_MS = 60000;
const morganQueue = [];
const morganQueuedIds = new Set();

// Morgan slot management: 1 slot per phoneNumberId (Twilio number)
const MORGAN_PHONE_NUMBER_IDS = process.env.VAPI_PHONE_NUMBER_IDS
  ? process.env.VAPI_PHONE_NUMBER_IDS.split(",").map(s => s.trim()).filter(Boolean)
  : [];

if (MORGAN_PHONE_NUMBER_IDS.length !== 3) {
  console.warn("[MorganSlots] Expected exactly 3 VAPI_PHONE_NUMBER_IDS for Morgan slots, got:", MORGAN_PHONE_NUMBER_IDS.length);
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
  console.log("[MorganSlots] Freed slot", phoneNumberId);
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
  console.log("[MorganSlots] Freed slot", phoneNumberId, "for callId", callId);
  return true;
}

function enqueueMorganLead(lead) {
  if (!lead || !lead.id) return;

  // In-memory dedupe
  if (morganQueuedIds.has(lead.id)) {
    console.log("[MorganQueue] Skipping duplicate lead", lead.id);
    return;
  }

  morganQueue.push(lead);
  morganQueuedIds.add(lead.id);

  // Persist in Convoso: mark as queued for Morgan
  updateConvosoLead({
    lead_id: lead.id,
    status: "MQ"
  }).catch((err) => {
    console.error("[MorganQueue] Failed to set MQ status for", lead.id, err);
  });

  console.log(
    "[MorganQueue] Enqueued lead",
    lead.id,
    "Queue length:",
    morganQueue.length
  );
}

function getNextMorganLead() {
  const lead = morganQueue.shift();
  if (!lead) return null;

  if (lead.id) {
    morganQueuedIds.delete(lead.id);

    // Mark as moved from queue into active calling state
    updateConvosoLead({
      lead_id: lead.id,
      status: "MC",
    }).catch((err) => {
      console.error("[MorganQueue] Failed to set MC status for", lead.id, err);
    });
  }

  console.log("[MorganQueue] Dequeued lead", lead.id, "for dialing");
  return lead;
}

// ---- Convoso helpers (use original working pattern) ----

// Generic lead update: uses GET with auth_token in query string
async function updateConvosoLead(leadIdOrPayload, fields = {}) {
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
  console.log("[updateConvosoLead] URL:", url);

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    console.error("[updateConvosoLead] Convoso error:", response.status, text);
    throw new Error("Convoso lead update failed");
  }

  const data = await response.json();
  console.log("[updateConvosoLead] response:", JSON.stringify(data).slice(0, 500));
  return data;
}

// "Add note" just means: update the lead's notes field
async function addLeadNote(leadId, note) {
  // ⚠️ This overwrites the Notes field in Convoso for that lead.
  return updateConvosoLead(leadId, { notes: note });
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
  let page = 1;
  while (page <= maxPages) {
    const payload = { ...basePayload, page };
    const res = await fetch("https://api.convoso.com/v1/leads/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[convosoSearchAllPages] HTTP", res.status, text);
      throw new Error("Convoso search failed");
    }
    const data = await res.json();
    const pageLeads = data.data || data.leads || data.results || [];
    results.push(...pageLeads);
    const lim = Number(basePayload.limit) || 200;
    if (!Array.isArray(pageLeads) || pageLeads.length < lim) break;
    page += 1;
  }
  return results;
}

async function hydrateMorganQueueFromConvoso() {
  if (!CONVOSO_AUTH_TOKEN) {
    console.warn("[MorganQueue] Skipping hydration: missing CONVOSO_AUTH_TOKEN");
    return;
  }

  console.log("[MorganQueue] Hydrating from Convoso MQ status (no date filter)...");

  // Clear any stale state
  morganQueue.length = 0;
  morganQueuedIds.clear();

  try {
    const raw = await convosoSearchAllPages({
      auth_token: CONVOSO_AUTH_TOKEN,
      status: "MQ",
      list_id: MORGAN_LIST_IDS,
      limit: 200,
    });

    console.log("[MorganQueue] Raw MQ rows from Convoso:", raw.length);

    let missingPhone = 0;
    let memberIdSet = 0;
    let wrongCallCount = 0;

    raw
      .map(normalizeConvosoLead)
      .filter(Boolean)
      .forEach((lead) => {
        if (!hasEmptyMemberId(lead)) {
          memberIdSet += 1;
          return;
        }

        if (!lead.phone) {
          missingPhone += 1;
          return;
        }

        if (
          typeof lead.call_count !== "number" ||
          (lead.call_count !== 2 && lead.call_count !== 5)
        ) {
          wrongCallCount += 1;
          return;
        }

        if (!lead.id || morganQueuedIds.has(lead.id)) return;

        morganQueue.push(lead);
        morganQueuedIds.add(lead.id);
      });

    console.log(
      `[MorganQueue] Hydrated queue length from MQ: ${morganQueue.length}. Skipped missing phone: ${missingPhone}, Member_ID set: ${memberIdSet}, wrong call_count: ${wrongCallCount}.`
    );
  } catch (err) {
    console.error("[MorganQueue] Failed to hydrate from Convoso:", err);
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
    console.error("[convosoSearchPage] HTTP", res.status, text);
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

      if (leadId) {
        try {
          await updateConvosoLead(leadId, { status: "A" });
          console.log(`[MorganQueue] Marked lead ${leadId} as finished (status A).`);
        } catch (err) {
          console.error("[VapiWebhook] Failed to update Convoso status to A for lead", leadId, err);
        }
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
  let lead = null;
  let freeSlotId = null;
  try {
    freeSlotId = getFreeMorganSlotId();
    if (!freeSlotId) {
      // All 3 numbers are busy; do nothing this tick
      return;
    }

    lead = getNextMorganLead();
    if (!lead || !lead.phone) return;

    console.log("[MorganQueue] Using slot", freeSlotId, "for lead", lead.id, "phone", lead.phone);

    try {
      const result = await startOutboundCall({
        agentName: "Morgan",
        toNumber: lead.phone,
        metadata: {
          convosoLeadId: lead.id || null,
          convosoListId: lead.raw?.list_id || null,
          source: "morgan-queue",
          convosoRaw: lead.raw || null,
        },
        callName: "Morgan Outbound (Queue)",
        phoneNumberId: freeSlotId, // bind this call to a specific Twilio number
      });

      if (result && result.callId) {
        markMorganSlotBusy(freeSlotId, result.callId);
        console.log("[MorganQueue] Call started with callId", result.callId, "on slot", freeSlotId);
      } else {
        console.warn("[MorganQueue] startOutboundCall returned no callId; re-queueing lead");
        morganQueue.unshift(lead);
        if (lead.id) {
          morganQueuedIds.add(lead.id);
          updateConvosoLead({
            lead_id: lead.id,
            status: "MQ",
          }).catch((err) => {
            console.error("[MorganQueue] Failed to set MQ status while re-queueing", lead.id, err);
          });
        }
      }
    } catch (err) {
      console.error("[processMorganQueueTick] error starting call:", err);

      await updateConvosoLead({
        lead_id: lead.id,
        status: "MQ"
      }).catch((e) => {
        console.error("[processMorganQueueTick] failed to revert status to MQ for lead", lead.id, e);
      });

      enqueueMorganLead(lead);

      if (freeSlotId) {
        freeMorganSlot(freeSlotId);
      }

      return;
    }
  } catch (err) {
    console.error("[processMorganQueueTick] error:", err);
  }
}

setInterval(processMorganQueueTick, MORGAN_DIAL_INTERVAL_MS);

// ----- AUTO PULL MORGAN LEADS EVERY 60 SECONDS -----
async function autoPullMorganLeads() {
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

    console.log("[sendLeadNote] Adding note for lead:", leadId);
    console.log("[sendLeadNote] Note content:", noteFromMorgan);

    await addLeadNote(leadId, noteFromMorgan);

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
