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

// ----- MORGAN OUTBOUND QUEUE -----
const MORGAN_MAX_CONCURRENT = 3;
const MORGAN_DIAL_INTERVAL_MS = 3000;
const morganQueue = [];
let morganActiveCalls = 0;

function enqueueMorganLead(lead) {
  if (!lead || !lead.phone) return;
  morganQueue.push(lead);
  console.log(
    `[MorganQueue] Enqueued lead ${lead.id} (${lead.phone}). Queue length: ${morganQueue.length}`
  );
}

// ---- Convoso helpers (use original working pattern) ----

// Generic lead update: uses GET with auth_token in query string
async function updateConvosoLead(leadId, fields = {}) {
  if (!CONVOSO_AUTH_TOKEN) {
    throw new Error("Missing CONVOSO_AUTH_TOKEN env var");
  }
  if (!leadId) {
    throw new Error("leadId is required for updateConvosoLead");
  }

  const params = new URLSearchParams({
    auth_token: CONVOSO_AUTH_TOKEN,
    lead_id: String(leadId),
  });

  Object.entries(fields).forEach(([key, value]) => {
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
  return {
    id: convosoLead.lead_id || convosoLead.id,
    list_id: convosoLead.list_id,
    first_name: convosoLead.first_name,
    last_name: convosoLead.last_name,
    phone: convosoLead.phone_number,
    phone_number: convosoLead.phone_number,
    state: convosoLead.state,
    call_count: convosoLead.called_count,
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

async function findLeadsForMorganByCallCount({ limit = 50, timezone = "America/New_York" } = {}) {
  if (!CONVOSO_AUTH_TOKEN) {
    throw new Error("Missing CONVOSO_AUTH_TOKEN env var");
  }

  const tz = timezone || "America/New_York";
  const { start, end } = getDayWindowStrings(tz, 0); // TODAY

  const payload = {
    auth_token: CONVOSO_AUTH_TOKEN,
    limit: 200,
    page: 1,
    list_id: MORGAN_LIST_IDS,
    filters: [
      { field: "created_at", comparison: ">=", value: start },
      { field: "created_at", comparison: "<=", value: end },
      // keep these EXACTLY as they were:
      { field: "call_count", comparison: ">=", value: 1 },
      { field: "call_count", comparison: "<=", value: 5 },
    ],
  };

  console.log("[Morgan/pull-leads] created_at window:", { start, end, tz });
  console.log("[Morgan/pull-leads] filters preview:", payload.filters);

  const allRaw = await convosoSearchAllPages(payload);
  console.log("[Morgan/pull-leads] convoso total fetched (pre-filter):", allRaw.length);
  const filtered = allRaw
    .map(normalizeConvosoLead)
    .filter(Boolean)
    .filter((ld) => ld.Member_ID === "" || ld.Member_ID == null);
  console.log("[Morgan/pull-leads] after Member_ID filter:", filtered.length);
  return filtered.filter((ld) => ld.phone);
}

function getTimezoneDate(timeZone) {
  return new Date(new Date().toLocaleString("en-US", { timeZone }));
}

function getDayWindowStrings(timeZone = "America/New_York", daysBack = 0) {
  // Get today's Y/M/D in the target TZ
  const now = new Date();
  const ymdParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = +ymdParts.find((p) => p.type === "year").value;
  const m = +ymdParts.find((p) => p.type === "month").value;
  const d = +ymdParts.find((p) => p.type === "day").value;

  // Anchor to "today-at-noon UTC", then move daysBack in UTC to avoid DST edge cases
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  noonUTC.setUTCDate(noonUTC.getUTCDate() - daysBack);

  // Get the target Y/M/D in the target TZ
  const tgt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(noonUTC);
  const Y = tgt.find((p) => p.type === "year").value;
  const M = tgt.find((p) => p.type === "month").value;
  const D = tgt.find((p) => p.type === "day").value;

  // Return Convoso-ready strings
  return {
    start: `${Y}-${M}-${D} 00:00:00`,
    end: `${Y}-${M}-${D} 23:59:59`,
    ymd: `${Y}-${M}-${D}`,
  };
}

function formatConvosoDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

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

async function findYesterdayNonSaleLeads({ timezone = "America/New_York" } = {}) {
  if (!CONVOSO_AUTH_TOKEN) {
    throw new Error("Missing CONVOSO_AUTH_TOKEN env var");
  }

  const tz = timezone || "America/New_York";
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(
    new Date()
  );
  const daysBack = weekday === "Mon" ? 3 : 1; // Mon → Friday, else → yesterday
  const { start, end } = getDayWindowStrings(tz, daysBack);

  const payload = {
    auth_token: CONVOSO_AUTH_TOKEN,
    limit: 200,
    page: 1,
    list_id: MORGAN_LIST_IDS,
    filters: [
      { field: "created_at", comparison: ">=", value: start },
      { field: "created_at", comparison: "<=", value: end },
    ],
  };

  console.log("[Morgan/pull-yesterday] created_at window (prior working day):", {
    start,
    end,
    tz,
    weekday,
    daysBack,
  });
  console.log("[Morgan/pull-yesterday] filters preview:", payload.filters);

  const allRaw = await convosoSearchAllPages(payload);
  console.log("[Morgan/pull-yesterday] convoso total fetched (pre-filter):", allRaw.length);
  const filtered = allRaw
    .map(normalizeConvosoLead)
    .filter(Boolean)
    .filter((ld) => ld.Member_ID === "" || ld.Member_ID == null);
  console.log("[Morgan/pull-yesterday] after Member_ID filter:", filtered.length);
  return filtered.filter((ld) => ld.phone);
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
      enqueueMorganLead(lead);
      await updateConvosoLead(lead.id, { status: "MORGAN_QUEUED" });
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
      enqueueMorganLead(lead);
      await updateConvosoLead(lead.id, { status: "MORGAN_REQUEUE" });
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

// ----- MORGAN QUEUE PROCESSOR -----
async function processMorganQueueTick() {
  try {
    if (morganActiveCalls >= MORGAN_MAX_CONCURRENT) return;

    const lead = morganQueue.shift();
    if (!lead) return;
    if (!lead.phone) return;

    morganActiveCalls++;

    startOutboundCall({
      agentName: "Morgan",
      toNumber: lead.phone,
      metadata: {
        convosoLeadId: lead.id || null,
        convosoListId: lead.raw?.list_id || null,
        source: "morgan-queue",
        convosoRaw: lead.raw || null
      },
      callName: "Morgan Outbound (Queue)"
    })
      .then(result => console.log("[MorganQueue] Call started:", result))
      .catch(err => console.error("[MorganQueue] Error:", err))
      .finally(() => {
        morganActiveCalls--;
        if (morganActiveCalls < 0) morganActiveCalls = 0;
      });
  } catch (err) {
    console.error("[processMorganQueueTick] error:", err);
  }
}

setInterval(processMorganQueueTick, MORGAN_DIAL_INTERVAL_MS);


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
const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
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
