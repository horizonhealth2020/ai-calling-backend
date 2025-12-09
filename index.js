// index.js

// Main Express backend:
//  - Convoso webhooks
//  - Tools for Morgan & Riley
//  - Uses voiceGateway for outbound calls (Vapi)
 
const express = require("express");
const cors = require("cors");
const { startOutboundCall } = require("./voiceGateway");

// ----- BASIC SETUP -----
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Convoso sends application/x-www-form-urlencoded, so we need this:
app.use(express.urlencoded({ extended: true }));

// For JSON payloads (your own tests, etc.)
app.use(express.json());

// ----- CONVOSO CONFIG -----
const CONVOSO_SALES_NUMBER     = process.env.CONVOSO_SALES_NUMBER     || "+18887990191";
const CONVOSO_BILLING_NUMBER   = process.env.CONVOSO_BILLING_NUMBER   || "+15550000002";
const CONVOSO_GENERAL_NUMBER   = process.env.CONVOSO_GENERAL_NUMBER   || "+15550000003";
const CONVOSO_RETENTION_NUMBER = process.env.CONVOSO_RETENTION_NUMBER || "+15550000004";
const CONVOSO_AUTH_TOKEN       = process.env.CONVOSO_AUTH_TOKEN;

// ----- HELPER: UPDATE CONVOSO LEAD -----
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

// ----- HEALTHCHECK -----
app.get("/health", (req, res) => {
  res.json({ ok: true, env: "ai-calling-backend", version: "v3-voice-gateway" });
});

// ----- WEBHOOK: CONVOSO → MORGAN OUTBOUND -----
app.post("/webhooks/convoso/new-lead", async (req, res) => {
  try {
    console.log("[Convoso webhook] headers:", req.headers);
    console.log("[Convoso webhook] raw body:", req.body);

    let body = req.body || {};

    // CASE B: x-www-form-urlencoded with a single JSON key
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

    // CASE C: url/params style
    if (
      (!body.phone && !body.phone_number && !body.phoneNumber) &&
      typeof body.params === "string"
    ) {
      try {
        const parsedParams = JSON.parse(body.params.trim());
        console.log("[Convoso webhook] parsed body.params JSON:", parsedParams);
        body = parsedParams;
      } catch (e) {
        console.error("[Convoso webhook] failed to parse body.params JSON:", e);
      }
    }

    const customerNumberRaw =
      body.phone_number ||
      body.phone ||
      body.phoneNumber ||
      body.Phone ||
      body.PHONE;

    if (!customerNumberRaw) {
      console.error("[Convoso webhook] Missing phone number. Body was:", body);
      return res.status(200).json({
        success: false,
        error: "Missing phone number in Convoso payload",
      });
    }

    // Normalize to E.164 (US default)
    let customerNumber = String(customerNumberRaw).trim();
    customerNumber = customerNumber.replace(/\D/g, "");
    if (!customerNumber.startsWith("+")) {
      customerNumber = "+1" + customerNumber;
    }

    const metadata = {
      convosoLeadId: body.lead_id || body.id || null,
      convosoListId: body.list_id || null,
      convosoRaw: body,
      source: "convoso",
    };

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

// ----- HELPER: EXTRACT TOOL ARGS FROM VAPI TOOL SERVER BODY -----
function extractToolArguments(body, toolName) {
  const b = body || {};

  // 0) If it's already flat, just return it
  if (
    b.intent ||
    b.qualification_status ||
    b.agent_name ||
    b.call_session_id ||
    b.lead_id ||
    b.phone
  ) {
    return b;
  }

  // 1) New Vapi tool-server shape: { toolCall: { name, arguments }, ... }
  if (b.toolCall || b.tool_call) {
    const tc = b.toolCall || b.tool_call;
    let toolArgs = tc.arguments || tc.args || tc.parameters || tc.input || tc.params;
    if (typeof toolArgs === "string") {
      try {
        toolArgs = JSON.parse(toolArgs);
      } catch (e) {
        console.error("[extractToolArguments] Failed to parse toolCall.arguments JSON:", e);
      }
    }
    if (toolArgs && typeof toolArgs === "object") {
      return toolArgs;
    }
  }

  // 2) Top-level arguments
  if (b.arguments || b.args || b.parameters || b.input || b.params) {
    let toolArgs = b.arguments || b.args || b.parameters || b.input || b.params;
    if (typeof toolArgs === "string") {
      try {
        toolArgs = JSON.parse(toolArgs);
      } catch (e) {
        console.error("[extractToolArguments] Failed to parse top-level arguments JSON:", e);
      }
    }
    if (toolArgs && typeof toolArgs === "object") {
      return toolArgs;
    }
  }

  // 3) Message-based shapes: message.toolCalls / toolCallList / toolWithToolCallList
  const msg = b.message;
  if (!msg) return b;

  const candidates =
    (Array.isArray(msg.toolCalls) && msg.toolCalls) ||
    (Array.isArray(msg.toolCallList) && msg.toolCallList) ||
    (Array.isArray(msg.toolWithToolCallList) && msg.toolWithToolCallList) ||
    null;

  if (!candidates) return b;

  // Helper to unwrap a single toolCall-like object
  function getArgsFromCandidate(c) {
    if (!c) return null;

    // Some shapes: { name, arguments: {...} }
    if (c.arguments || c.args || c.parameters || c.input || c.params) {
      return c.arguments || c.args

// ----- TOOL: getLead -----
app.post("/tools/getLead", async (req, res) => {
  try {
    console.log(
      "[getLead] RAW BODY:",
      JSON.stringify(req.body, null, 2).slice(0, 2000)
    );

    const args = extractToolArguments(req.body, "getLead");
    const { phone, lead_id } = args || {};

    if (!phone && !lead_id) {
      console.error("[getLead] Missing phone/lead_id in args:", args);
      return res.status(400).json({ error: "phone or lead_id is required" });
    }

    if (!CONVOSO_AUTH_TOKEN) {
      console.error("[getLead] Missing CONVOSO_AUTH_TOKEN env var");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    const searchParams = new URLSearchParams({
      auth_token: CONVOSO_AUTH_TOKEN,
      lead_id: lead_id || "",
      list_id: "",
      user_id: "",
      status: "",
      offset: "0",
      limit: "10",
      created_by: "",
      email: "",
      last_modified_by: "",
      owner_id: "",
      first_name: "",
      last_name: "",
      phone_number: phone || "",
      alt_phone_1: "",
      alt_phone_2: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      province: "",
      postal_code: "",
      country: "",
      gender: "",
      date_of_birth: "",
      plan_sold: "",
      member_id: "",
      created_at_start_date: "",
      created_at_end_date: "",
      updated_at_start_date: "",
      updated_at_end_date: "",
      deleted_at_start: "",
      deleted_at_end: "",
      archived_at_start: "",
      archived_at_end: "",
      last_call_start_date: "",
      last_call_end_date: "",
    });

    const url = `https://api.convoso.com/v1/leads/search?${searchParams.toString()}`;
    console.log("[getLead] Convoso URL:", url);

    const response = await fetch(url);
    if (!response.ok) {
      console.error("[getLead] Convoso error status:", response.status);
      return res.status(502).json({ error: "Convoso search failed" });
    }

    const data = await response.json();
    console.log(
      "[getLead] Convoso response (truncated):",
      JSON.stringify(data).slice(0, 500)
    );

    const convosoLead =
      data && Array.isArray(data.data) && data.data.length > 0
        ? data.data[0]
        : null;

    if (!convosoLead) {
      return res.json({ lead: null });
    }

    const lead = {
      id: convosoLead.id,
      first_name: convosoLead.first_name,
      last_name: convosoLead.last_name,
      phone: convosoLead.phone_number,
      state: convosoLead.state,
      tags: [],
      raw: convosoLead,
    };

    return res.json({ lead });
  } catch (err) {
    console.error("[getLead] error:", err);
    res.status(500).json({ error: "getLead failed" });
  }
});

// ----- TOOL: logCallOutcome -----
app.post("/tools/logCallOutcome", async (req, res) => {
  try {
    console.log(
      "[logCallOutcome] RAW BODY:",
      JSON.stringify(req.body, null, 2).slice(0, 2000)
    );

    const args = extractToolArguments(req.body, "logCallOutcome");

    const {
      call_session_id,
      lead_id,
      qualification_status,
      disposition,
      notes,
      should_transfer_now,
      agent_name,
      convoso_update_fields,
    } = args || {};

    console.log("[logCallOutcome] parsed args:", {
      call_session_id,
      lead_id,
      qualification_status,
      disposition,
      should_transfer_now,
      agent_name,
      convoso_update_fields,
      timestamp: new Date().toISOString(),
    });

    let convosoResult = null;

    if (lead_id) {
      const updateFields = {
        status: qualification_status || undefined,
        disposition: disposition || undefined,
        notes: notes || undefined,
        ...(convoso_update_fields || {}),
      };

      Object.keys(updateFields).forEach((k) => {
        if (
          updateFields[k] === undefined ||
          updateFields[k] === null ||
          updateFields[k] === ""
        ) {
          delete updateFields[k];
        }
      });

      if (Object.keys(updateFields).length > 0) {
        try {
          convosoResult = await updateConvosoLead(lead_id, updateFields);
        } catch (err) {
          console.error("[logCallOutcome] Convoso update failed:", err);
        }
      }
    }

    return res.json({
      success: true,
      convoso_result: convosoResult,
      should_transfer_now: !!should_transfer_now,
    });
  } catch (err) {
    console.error("[logCallOutcome] error:", err);
    return res.status(500).json({ error: "logCallOutcome failed" });
  }
});

// ----- TOOL: getRoutingTarget -----
app.post("/tools/getRoutingTarget", async (req, res) => {
  try {
    console.log(
      "[getRoutingTarget] RAW BODY:",
      JSON.stringify(req.body, null, 2).slice(0, 2000)
    );

    const args = extractToolArguments(req.body, "getRoutingTarget");

    const { intent, qualification_status, agent_name } = args || {};

    console.log("[getRoutingTarget] parsed args:", {
      intent,
      qualification_status,
      agent_name,
      rawKeys: Object.keys(args || {}),
    });

    const agent = (agent_name || "").toLowerCase();

    let routing_target = "general_queue";
    let phone_number = CONVOSO_GENERAL_NUMBER;

    const isQualified = qualification_status === "qualified";
    const isRiley = agent === "riley";

    if (isQualified && intent === "sales" && !isRiley) {
      routing_target = "sales_queue";
      phone_number = CONVOSO_SALES_NUMBER;
    } else if (intent === "billing" || intent === "billing_question") {
      routing_target = "billing_queue";
      phone_number = CONVOSO_BILLING_NUMBER;
    } else if (
      intent === "cancellation" ||
      intent === "cancel plan" ||
      intent === "retention"
    ) {
      routing_target = "retention_queue";
      phone_number = CONVOSO_RETENTION_NUMBER;
    } else {
      routing_target = "general_queue";
      phone_number = CONVOSO_GENERAL_NUMBER;
    }

    // Hard rule: Riley can NEVER go to sales
    if (isRiley && routing_target === "sales_queue") {
      console.log(
        "[getRoutingTarget] Riley attempted sales transfer; overriding to general_queue"
      );
      routing_target = "general_queue";
      phone_number = CONVOSO_GENERAL_NUMBER;
    }

    return res.json({ routing_target, phone_number });
  } catch (err) {
    console.error("[getRoutingTarget] error:", err);
    return res.status(500).json({ error: "getRoutingTarget failed" });
  }
});

// ----- TOOL: scheduleCallback -----
app.post("/tools/scheduleCallback", async (req, res) => {
  try {
    const {
      lead_id,
      phone,
      scheduled_time_iso,
      timezone,
      notes,
      agent_name,
      convoso_update_fields,
    } = req.body || {};

    if (!lead_id || !scheduled_time_iso) {
      return res.status(400).json({
        error: "lead_id and scheduled_time_iso are required",
      });
    }

    console.log("[scheduleCallback] request:", {
      lead_id,
      phone,
      scheduled_time_iso,
      timezone,
      notes,
      agent_name,
      convoso_update_fields,
    });

    const updateFields = {
      callback_time: scheduled_time_iso,
      callback_timezone: timezone || "",
      callback_phone: phone || "",
      callback_notes: notes || "",
      ...(convoso_update_fields || {}),
    };

    let convosoResult = null;
    try {
      convosoResult = await updateConvosoLead(lead_id, updateFields);
    } catch (err) {
      console.error("[scheduleCallback] Convoso update failed:", err);
    }

    res.json({
      success: true,
      action: "callback_scheduled",
      scheduled_time_iso,
      timezone,
      convoso_result: convosoResult,
    });
  } catch (err) {
    console.error("[scheduleCallback] error:", err);
    res.status(500).json({ error: "scheduleCallback failed" });
  }
});

// ----- DEBUG: DIRECT TEST CALL TO MORGAN -----
app.post("/debug/test-call", async (req, res) => {
  try {
    const { phone } = req.body || {};

    if (!phone) {
      return res.status(400).json({
        success: false,
        error:
          "Missing 'phone' in body. Example: { \"phone\": \"+13055551234\" }",
      });
    }

    let customerNumber = String(phone).trim();
    if (!customerNumber.startsWith("+")) {
      customerNumber = "+1" + customerNumber.replace(/\D/g, "");
    }

    console.log(
      "[DEBUG /debug/test-call] starting Morgan call to:",
      customerNumber
    );

    const result = await startOutboundCall({
      agentName: "Morgan",
      toNumber: customerNumber,
      metadata: { source: "debug-test-call" },
      callName: "Morgan Debug Test",
    });

    console.log("[DEBUG /debug/test-call] Vapi result:", result);

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
      error: err.message || "Unknown error",
    });
  }
});

// ----- START SERVER -----
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
