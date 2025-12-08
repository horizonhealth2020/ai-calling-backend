// index.js

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { startOutboundCall } = require("./voiceGateway");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------------------------
// ENV CONFIG
// ---------------------------
const CONVOSO_SALES_NUMBER     = process.env.CONVOSO_SALES_NUMBER     || "+18887990191";
const CONVOSO_BILLING_NUMBER   = process.env.CONVOSO_BILLING_NUMBER   || "+15550000002";
const CONVOSO_GENERAL_NUMBER   = process.env.CONVOSO_GENERAL_NUMBER   || "+15550000003";
const CONVOSO_RETENTION_NUMBER = process.env.CONVOSO_RETENTION_NUMBER || "+15550000004";
const CONVOSO_AUTH_TOKEN       = process.env.CONVOSO_AUTH_TOKEN;


// ---------------------------
// HELPER: UPDATE LEAD
// ---------------------------
async function updateConvosoLead(leadId, fields = {}) {
  if (!CONVOSO_AUTH_TOKEN) throw new Error("Missing CONVOSO_AUTH_TOKEN");
  if (!leadId) throw new Error("leadId is required");

  const params = new URLSearchParams({
    auth_token: CONVOSO_AUTH_TOKEN,
    lead_id: String(leadId),
  });

  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.append(k, String(v));
  });

  const url = `https://api.convoso.com/v1/leads/update?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Convoso update failed");

  return await response.json();
}


// ---------------------------
// HELPER: GET LEAD BY ID
// ---------------------------
async function fetchConvosoLeadById(leadId) {
  const searchParams = new URLSearchParams({
    auth_token: CONVOSO_AUTH_TOKEN,
    lead_id: String(leadId),
    offset: "0",
    limit: "1",
  });

  const url = `https://api.convoso.com/v1/leads/search?${searchParams.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  return data.data?.[0] || null;
}


// ---------------------------
// HELPER: GET LEAD BY PHONE
// ---------------------------
async function fetchConvosoLeadByPhone(phone) {
  const searchParams = new URLSearchParams({
    auth_token: CONVOSO_AUTH_TOKEN,
    phone_number: String(phone),
    offset: "0",
    limit: "1",
  });

  const url = `https://api.convoso.com/v1/leads/search?${searchParams.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  return data.data?.[0] || null;
}


// ---------------------------
// HEALTH
// ---------------------------
app.get("/health", (req, res) => res.json({ ok: true }));


// ---------------------------
// CONVOSO → MORGAN OUTBOUND
// ---------------------------
app.post("/webhooks/convoso/new-lead", async (req, res) => {
  try {
    let body = req.body;

    // Handle weird Convoso JSON-in-key format
    if (Object.keys(body).length === 1) {
      const key = Object.keys(body)[0];
      if (key.startsWith("{")) {
        body = JSON.parse(key);
      }
    }

    let phone = body.phone_number || body.phone || "";
    phone = "+1" + phone.replace(/\D/g, "");

    const metadata = {
      convosoLeadId: body.lead_id || null,
      convosoListId: body.list_id || null,
      convosoRaw: body,
      source: "convoso",
    };

    const result = await startOutboundCall({
      agentName: "Morgan",
      toNumber: phone,
      metadata,
      callName: "Morgan Outbound Qualifier",
    });

    res.json({ success: true, call_id: result.callId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "webhook failed" });
  }
});


// ---------------------------
// TOOL: getLead
// ---------------------------
app.post("/tools/getLead", async (req, res) => {
  try {
    const { phone, lead_id } = req.body;

    let lead = null;
    if (lead_id) {
      lead = await fetchConvosoLeadById(lead_id);
    } else if (phone) {
      lead = await fetchConvosoLeadByPhone(phone);
    }

    res.json({ lead });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "getLead failed" });
  }
});


// ---------------------------
// TOOL: logCallOutcome (APPEND NOTES HERE)
// ---------------------------
app.post("/tools/logCallOutcome", async (req, res) => {
  try {
    let {
      lead_id,
      phone,
      qualification_status,
      disposition,
      notes,
      should_transfer_now,
      agent_name,
      convoso_update_fields,
    } = req.body;

    // Resolve lead_id from phone if missing
    if (!lead_id && phone) {
      const lead = await fetchConvosoLeadByPhone(phone);
      if (lead) lead_id = lead.id;
    }

    if (!lead_id) {
      return res.json({
        success: false,
        error: "No lead_id (and could not resolve from phone)",
      });
    }

    // Get existing notes
    const existing = await fetchConvosoLeadById(lead_id);
    const pastNotes = existing?.notes?.trim() || "";

    // Append logic
    let finalNotes = notes?.trim() || "";
    if (pastNotes) {
      finalNotes = `${pastNotes}\n\n---\n${finalNotes}`;
    }

    const updateFields = {
      status: qualification_status || undefined,
      disposition: disposition || undefined,
      notes: finalNotes,
      ...(convoso_update_fields || {}),
    };

    // Remove empty keys
    Object.keys(updateFields).forEach((k) => {
      if (!updateFields[k]) delete updateFields[k];
    });

    const convoso_result = await updateConvosoLead(lead_id, updateFields);

    res.json({
      success: true,
      convoso_result,
      should_transfer_now: !!should_transfer_now,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "logCallOutcome failed" });
  }
});


// ---------------------------
// TOOL: getRoutingTarget
// ---------------------------
app.post("/tools/getRoutingTarget", (req, res) => {
  const { intent, qualification_status, agent_name } = req.body;
  const agent = (agent_name || "").toLowerCase();

  let routing_target = "general_queue";
  let phone_number = CONVOSO_GENERAL_NUMBER;

  if (qualification_status === "qualified" && intent === "sales" && agent !== "riley") {
    routing_target = "sales_queue";
    phone_number = CONVOSO_SALES_NUMBER;
  }

  res.json({ routing_target, phone_number });
});


// ---------------------------
// START SERVER
// ---------------------------
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
