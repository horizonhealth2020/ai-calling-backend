// server.js or index.js

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// === Convoso routing config (put your real numbers here) ===
// These are the numbers your Convoso queues listen on.
// You can put them in Railway env vars instead of hardcoding.
const CONVOSO_SALES_NUMBER   = process.env.CONVOSO_SALES_NUMBER   || "+15550000001";
const CONVOSO_BILLING_NUMBER = process.env.CONVOSO_BILLING_NUMBER || "+15550000002";
const CONVOSO_GENERAL_NUMBER = process.env.CONVOSO_GENERAL_NUMBER || "+15550000003";

app.use(cors());
app.use(express.json());

// -------------------------------------------------
// Healthcheck
// -------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ ok: true, env: "ai-calling-backend" });
});

// -------------------------------------------------
// Tool 1: getLead
//  - Called near the start of a call to fetch lead info
//  - For now returns dummy data; later you can plug in CRM/DB
// -------------------------------------------------
app.post("/tools/getLead", async (req, res) => {
  try {
    const { phone, lead_id } = req.body || {};

    // TODO: replace this with real DB/CRM lookup
    console.log("[getLead] request:", { phone, lead_id });

    const lead = {
      id: lead_id || "lead_dummy",
      first_name: "John",
      last_name: "Doe",
      phone: phone || "+15555550123",
      state: "FL",
      product_interest: "under_65_health",
      tags: ["test"],
    };

    res.json({ lead });
  } catch (err) {
    console.error("[getLead] error", err);
    res.status(500).json({ error: "getLead failed" });
  }
});

// -------------------------------------------------
// Tool 2: logCallOutcome
//  - Called near the end of call (or on transfer) to log outcome
//  - For now just logs; later you can push into Convoso/CRM
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
    console.log("[getRoutingTarget] request:", { intent, qualification_status });

    let routing_target = "general";
    let phone_number   = CONVOSO_GENERAL_NUMBER;

    // Simple examples — adjust to your needs:
    if (qualification_status === "qualified" && intent === "sales") {
      routing_target = "sales_queue";
      phone_number   = CONVOSO_SALES_NUMBER;
    } else if (intent === "billing" || intent === "billing_question") {
      routing_target = "billing_queue";
      phone_number   = CONVOSO_BILLING_NUMBER;
    } else if (intent === "sales") {
      // interest is sales but not fully qualified yet
      routing_target = "sales_queue";
      phone_number   = CONVOSO_SALES_NUMBER;
    } else {
      routing_target = "general_queue";
      phone_number   = CONVOSO_GENERAL_NUMBER;
    }

    res.json({
      routing_target,
      phone_number,
    });
  } catch (err) {
    console.error("[getRoutingTarget] error", err);
    res.status(500).json({ error: "getRoutingTarget failed" });
  }
});

app.listen(PORT, () => {
  console.log(`AI calling backend listening on port ${PORT}`);
});
