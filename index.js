const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // for calling Convoso + Vapi

const app = express();
const PORT = process.env.PORT || 3000;

// === Convoso routing config (put your real numbers here) ===
const CONVOSO_SALES_NUMBER     = process.env.CONVOSO_SALES_NUMBER     || "+18887990190";
const CONVOSO_BILLING_NUMBER   = process.env.CONVOSO_BILLING_NUMBER   || "+15550000002";
const CONVOSO_GENERAL_NUMBER   = process.env.CONVOSO_GENERAL_NUMBER   || "+15550000003";
const CONVOSO_RETENTION_NUMBER = process.env.CONVOSO_RETENTION_NUMBER || "+15550000004";

// === Convoso auth ===
const CONVOSO_AUTH_TOKEN = process.env.CONVOSO_AUTH_TOKEN;

// === Vapi config ===
const VAPI_API_KEY               = process.env.VAPI_API_KEY;
const VAPI_MORGAN_ASSISTANT_ID   = process.env.VAPI_MORGAN_ASSISTANT_ID; // outbound qualifier
const VAPI_RILEY_ASSISTANT_ID    = process.env.VAPI_RILEY_ASSISTANT_ID;  // customer service intake (optional)
const VAPI_PHONE_NUMBER_ID       = process.env.VAPI_PHONE_NUMBER_ID;     // Vapi phoneNumberId Morgan dials from

app.use(cors());
app.use(express.json());

// -------------------------------------------------
// Helper: call Convoso lead update
//  - Generic helper used by Morgan + Riley tools
// -------------------------------------------------
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

  // Pass through any additional fields (status, custom fields, notes, etc.)
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

// -------------------------------------------------
// Helper: call Vapi outbound /call for Morgan
//  - Used when Convoso sends new lead → we trigger Morgan
// -------------------------------------------------
async function startVapiOutboundCallForMorgan({ customerNumber, metadata = {} }) {
  if (!VAPI_API_KEY) {
    throw new Error("Missing VAPI_API_KEY env var");
  }
  if (!VAPI_MORGAN_ASSISTANT_ID) {
    throw new Error("Missing VAPI_MORGAN_ASSISTANT_ID env var");
  }
  if (!VAPI_PHONE_NUMBER_ID) {
    throw new Error("Missing VAPI_PHONE_NUMBER_ID env var");
  }
  if (!customerNumber) {
    throw new Error("customerNumber is required to start Vapi call");
  }

  const payload = {
    assistantId: VAPI_MORGAN_ASSISTANT_ID,
    phoneNumberId: VAPI_PHONE_NUMBER_ID,
    customer: {
      number: customerNumber,
    },
    metadata: {
      source: "convoso",
      ...metadata,
    },
    name: "Morgan Outbound Qualifier",
  };

  console.log("[Vapi] create call payload:", payload);

  const response = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[Vapi] create call error:", response.status, text);
    throw new Error("Vapi create call failed");
  }

  const data = await response.json();
  console.log("[Vapi] create call response:", JSON.stringify(data).slice(0, 500));
  return data;
}

// -------------------------------------------------
// Healthcheck
// -------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ ok: true, env: "ai-calling-backend", version: "v2-morgan-riley" });
});

// -------------------------------------------------
// WEBHOOK: Convoso → Railway (new lead for Morgan)
//  - Convoso sends lead data here
//  - We trigger an outbound Vapi call using Morgan
// -------------------------------------------------
app.post("/webhooks/convoso/new-lead", async (req, res) => {
  try {
    const lead = req.body || {};
    console.log("[Convoso webhook] new-lead payload:", lead);

    // Try to get a phone number from common field names
    const customerNumber =
      lead.phone_number || lead.phone || lead.phoneNumber || lead.Phone || lead.PHONE;

    if (!customerNumber) {
      return res.status(400).json({ error: "Missing phone number in Convoso payload" });
    }

    const metadata = {
      convosoLeadId: lead.id || lead.lead_id,
      convosoListId: lead.list_id,
      convosoRaw: lead,
    };

    const vapiCall = await startVapiOutboundCallForMorgan({
      customerNumber,
      metadata,
    });

    res.json({
      success: true,
      vapi_call_id: vapiCall.id || null,
    });
  } catch (err) {
    console.error("[Convoso webhook] error:", err);
    res.status(500).json({ error: "Failed to trigger Morgan outbound call" });
  }
});

// -------------------------------------------------
// Tool 1: getLead
//  - Used by Morgan / Riley to pull existing lead info by phone/lead_id
// -------------------------------------------------
app.post("/tools/getLead", async (req, res) => {
  try {
    const { phone, lead_id } = req.body || {};

    if (!phone && !lead_id) {
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
    console.log("[getLead] Convoso response (truncated):", JSON.stringify(data).slice(0, 500));

    const convosoLead =
      data && Array.isArray(data.data) && data.data.length > 0 ? data.data[0] : null;

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

// -------------------------------------------------
// Tool 2: logCallOutcome (Morgan + Riley)
//  - Morgan: end of outbound qualification
//  - Riley: end of customer service intake screen
//  - Updates Convoso lead (status, notes, disposition, etc.)
// -------------------------------------------------
app.post("/tools/logCallOutcome", async (req, res) => {
  try {
    const {
      call_session_id,
      lead_id,
      qualification_status,  // "qualified" | "not_qualified" | "unknown"
      disposition,           // free-text or enum
      notes,                 // summary from AI
      should_transfer_now,   // true/false
      agent_name,            // "Morgan" | "Riley" | etc.
      convoso_update_fields, // optional: { fieldName: value, ... }
    } = req.body || {};

    console.log("[logCallOutcome] request:", {
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

    // Push outcome into Convoso (if we have a lead_id)
    if (lead_id) {
      const updateFields = {
        // These keys depend on how your Convoso fields are named.
        // "status" is a standard Convoso field; notes/disposition may be custom.
        status: qualification_status || undefined,
        disposition: disposition || undefined,
        notes: notes || undefined,
        ...(convoso_update_fields || {}),
      };

      // Remove undefined/empty fields to avoid clearing values unintentionally
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

    res.json({
      success: true,
      convoso_result: convosoResult,
      should_transfer_now: !!should_transfer_now,
    });
  } catch (err) {
    console.error("[logCallOutcome] error", err);
    res.status(500).json({ error: "logCallOutcome failed" });
  }
});

// -------------------------------------------------
// Tool 3: getRoutingTarget
//  - Decides which Convoso queue/number to warm-transfer to
//  - Morgan can transfer to sales if qualified
//  - Riley is NEVER allowed to transfer to sales
// -------------------------------------------------
app.post("/tools/getRoutingTarget", async (req, res) => {
  try {
    const { intent, qualification_status, agent_name } = req.body || {};
    console.log("[getRoutingTarget] request:", req.body);

    const agent = (agent_name || "").toLowerCase();

    let routing_target = "general_queue";
    let phone_number = CONVOSO_GENERAL_NUMBER;

    const isQualified = qualification_status === "qualified";
    const isRiley = agent === "riley";

    // Sales routing (Morgan only)
    if (isQualified && intent === "sales" && !isRiley) {
      routing_target = "sales_queue";
      phone_number = CONVOSO_SALES_NUMBER;
    }
    // Billing questions
    else if (intent === "billing" || intent === "billing_question") {
      routing_target = "billing_queue";
      phone_number = CONVOSO_BILLING_NUMBER;
    }
    // Retention / cancellations
    else if (intent === "cancellation" || intent === "cancel plan" || intent === "retention") {
      routing_target = "retention_queue";
      phone_number = CONVOSO_RETENTION_NUMBER;
    }
    // Fallback
    else {
      routing_target = "general_queue";
      phone_number = CONVOSO_GENERAL_NUMBER;
    }

    // Hard rule: Riley can NEVER go to sales
    if (isRiley && routing_target === "sales_queue") {
      console.log("[getRoutingTarget] Riley attempted sales transfer; overriding to general_queue");
      routing_target = "general_queue";
      phone_number = CONVOSO_GENERAL_NUMBER;
    }

    res.json({ routing_target, phone_number });
  } catch (err) {
    console.error("[getRoutingTarget] error:", err);
    res.status(500).json({ error: "getRoutingTarget failed" });
  }
});

// -------------------------------------------------
// -------------------------------------------------
// Tool 4: scheduleCallback (Riley)
//  - Used when caller wants a specific callback time instead of transfer
//  - Right now this uses Convoso lead update to store callback info;
//    you can swap this to call Convoso callbacks/insert once you have that URL.
// -------------------------------------------------
app.post("/tools/scheduleCallback", async (req, res) => {
  try {
    const {
      lead_id,
      phone,
      scheduled_time_iso, // ISO string the caller requested
      timezone,           // e.g. "America/New_York"
      notes,
      agent_name,         // should be "Riley"
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

    // Strategy: store callback time + notes in Convoso fields.
    // Replace these keys with your actual Convoso custom fields.
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

    // If you later get the official "callbacks insert" URL from Convoso,
    // you can call it here instead of (or in addition to) updateConvosoLead.

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
