// index.js

// Main Express backend:
//  - Convoso webhook -> start Morgan
//  - Simple debug/test endpoint
//  - Uses voiceGateway for outbound calls (Vapi)

const express = require("express");
const cors = require("cors");
const { startOutboundCall } = require("./voiceGateway");
const CONVOSO_AUTH_TOKEN = process.env.CONVOSO_AUTH_TOKEN;

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


// --------------------------------------------------------------------------
// -------------------------- INSERTED ROUTES HERE ---------------------------
// --------------------------------------------------------------------------

// ----- TOOL: sendLeadNote -----
// Called by Vapi whenever Morgan wants to log a note for this lead.
// We ignore the tool arguments and just build a note from metadata.
app.post("/tools/sendLeadNote", async (req, res) => {
  try {
    const body = req.body || {};
    const message = body.message || {};
    const call = message.call || {};
    const metadata = call.metadata || {};
    const convosoRaw = metadata.convosoRaw || {};

    // Lead id from when we started the call
    const leadId = metadata.convosoLeadId;
    if (!leadId) {
      console.error("[sendLeadNote] No convosoLeadId in metadata");
      return res.status(200).json({
        results: [
          {
            name: "sendLeadNote",
            toolCallId: "unknown",
            result:
              "No convosoLeadId available, so note was not posted to Convoso.",
          },
        ],
      });
    }

    // Try to get some basic info for the note
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

    // Build a simple, useful note
    const note =
      `AI intake call handled by Morgan for ${displayName} (${state}), ` +
      `phone ${callerNumber}, Convoso lead_id ${leadId}. ` +
      `Intake questions were completed (first name, age, state, estimated income, ` +
      `individual/family plan, current insurance) and caller was transferred to a licensed agent.`;

    console.log("[sendLeadNote] Adding note for lead:", leadId, "note:", note);

    await addLeadNote(leadId, note);

    const toolCallId =
      (message.toolCallList &&
        Array.isArray(message.toolCallList) &&
        message.toolCallList[0] &&
        message.toolCallList[0].id) ||
      "unknown";

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
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
