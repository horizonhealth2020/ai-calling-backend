// index.js

// Main Express backend:
//  - Convoso webhook -> start Morgan
//  - Simple debug/test endpoint
//  - Uses voiceGateway for outbound calls (Vapi)

const express = require("express");
const cors = require("cors");
const { startOutboundCall } = require("./voiceGateway");

// ----- BASIC SETUP -----
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Convoso sends application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// For JSON payloads (your own tests, Postman, etc.)
app.use(express.json());

// ----- HEALTHCHECK -----
app.get("/", (req, res) => {
  res.json({ ok: true, message: "ai-calling-backend is running" });
});

// ----- WEBHOOK: CONVOSO → MORGAN OUTBOUND -----
app.post("/webhooks/convoso/new-lead", async (req, res) => {
  try {
    console.log("[Convoso webhook] headers:", req.headers);
    console.log("[Convoso webhook] raw body:", req.body);

    let body = req.body || {};

    // CASE B: x-www-form-urlencoded with a single JSON key
    // Example: { '{"first_name":"john","phone_number":"305..."}': '' }
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

    // CASE C: sometimes Convoso sends nested JSON in body.params
    if (body.params && typeof body.params === "string") {
      try {
        const parsedParams = JSON.parse(body.params);
        console.log("[Convoso webhook] parsed body.params JSON:", parsedParams);
        body = { ...body, ...parsedParams };
      } catch (e) {
        console.error("[Convoso webhook] failed to parse body.params JSON:", e);
      }
    }

    // Get the customer phone number from whatever field Convoso used
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

    // Normalize to +1E164
    let customerNumber = String(rawPhone).trim();
    customerNumber = customerNumber.replace(/\D/g, "");
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
      "with metadata:",
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
    res
      .status(500)
      .json({ error: "Failed to trigger Morgan outbound call" });
  }
});

// ----- DEBUG: MANUAL TEST CALL TO MORGAN -----
// POST /debug/test-call  { "phone": "+13055551234" }
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

    // Normalize similar to webhook
    let customerNumber = String(phone).trim();
    customerNumber = customerNumber.replace(/\D/g, "");
    if (!customerNumber.startsWith("+")) {
      customerNumber = "+1" + customerNumber;
    }

    console.log("[DEBUG /debug/test-call] starting Morgan call to:", customerNumber);

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
