const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // for calling Convoso

const app = express();
const PORT = process.env.PORT || 3000;

// === Convoso routing config (put your real numbers here) ===
// These are the numbers your Convoso queues listen on.
// Ideally you set them as Railway env vars, with these as defaults:
const CONVOSO_SALES_NUMBER     = process.env.CONVOSO_SALES_NUMBER     || "+18887990190";
const CONVOSO_BILLING_NUMBER   = process.env.CONVOSO_BILLING_NUMBER   || "+15550000002";
const CONVOSO_GENERAL_NUMBER   = process.env.CONVOSO_GENERAL_NUMBER   || "+15550000003";
const CONVOSO_RETENTION_NUMBER = process.env.CONVOSO_RETENTION_NUMBER || "+15550000004";

app.use(cors());
app.use(express.json());

// -------------------------------------------------
// Healthcheck
// -------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ ok: true, env: "ai-calling-backend", version: "v1-getLead-routing" });
});

// -------------------------------------------------
// Tool 1: getLead
//  - Called near the start of a call to fetch lead info
//  - Uses Convoso lead search API by phone or lead_id
// -------------------------------------------------
app.post("/tools/getLead", async (req, res) => {
  try {
    const { phone, lead_id } = req.body || {};

    if (!phone && !lead_id) {
      return res.status(400).json({ error: "phone or lead_id is required" });
    }

    const authToken = process.env.CONVOSO_AUTH_TOKEN;
    if (!authToken) {
      console.error("[getLead] Missing CONVOSO_AUTH_TOKEN env var");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    // Build the Convoso search URL
    const searchParams = new URLSearchParams({
      auth_token: authToken,
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
      last_call_end_date: ""
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
      data && Array.isArray(data.data) && data.data.length > 0
        ? data.data[0]
        : null;

    if (!convosoLead) {
      // No lead found for that phone/lead_id
      return res.json({ lead: null });
    }

    // Map Convoso fields to what your Vapi agent expects
    const lead = {
      id: convosoLead.id,
      first_name: convosoLead.first_name,
      last_name: convosoLead.last_name,
      phone: convosoLead.phone_number,
      state: convosoLead.state,
      // Add more if needed:
      // product_interest: convosoLead.plan_sold,
      // member_id: convosoLead.member_id,
      tags: [],
      raw: convosoLead // optional, for debugging
    };

    return res.json({ lead });

  } catch (err) {
    console.error("[getLead] error:", err);
    res.status(500).json({ error: "getLead failed" });
  }
});

// -------------------------------------------------
// Tool 2: logCallOutcome
//  - Called near the end of call (or on transfer) to log outcome
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
      agent_name,            // which AI agent (Morgan, inbound, etc.)
    } = req.body || {};

    console.log("[logCallOutcome]", {
      call_session_id,
      lead_id,
      qualification_status,
      disposition,
      notes,
      should_transfer_now,
      agent_name,
      timestamp: new Date().toISOString(),
    });

    // TODO: persist to DB / send to CRM / send to Convoso webhook
    res.json({ success: true });
  } catch (err) {
    console.error("[logCallOutcome] error", err);
    res.status(500).json({ error: "logCallOutcome failed" });
  }
});

// -------------------------------------------------
// Tool 3: getRoutingTarget
//  - Decides WHICH Convoso queue/number to send the call to
//  - Used when AI is ready to warm-transfer
// -------------------------------------------------
app.post("/tools/getRoutingTarget", async (req, res) => {
  try {
    const { intent, qualification_status } = req.body || {};

    console.log("[getRoutingTarget] request:", req.body);

    let routing_target = "general_queue";
    let phone_number = CONVOSO_GENERAL_NUMBER;

    if (qualification_status === "qualified" && intent === "sales") {
      routing_target = "sales_queue";
      phone_number = CONVOSO_SALES_NUMBER;

    } else if (intent === "billing" || intent === "billing_question") {
      routing_target = "billing_queue";
      phone_number = CONVOSO_BILLING_NUMBER;

    } else if (intent === "cancellation" || intent === "cancel plan") {
      routing_target = "retention_queue";
      phone_number = CONVOSO_RETENTION_NUMBER;

    } else {
      routing_target = "general_queue";
      phone_number = CONVOSO_GENERAL_NUMBER;
    }

    res.json({ routing_target, phone_number });

  } catch (err) {
    console.error("[getRoutingTarget] error:", err);
    res.status(500).json({ error: "getRoutingTarget failed" });
  }
});

app.listen(PORT, () => {
  console.log(`AI calling backend listening on port ${PORT}`);
});
