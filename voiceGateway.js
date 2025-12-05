// voiceGateway.js
//
// Simple Vapi-only implementation of startOutboundCall.
// Once this is stable, you can re-introduce Twilio/abstraction later.

const fetch = require("node-fetch");

// --- Vapi env vars ---
const VAPI_API_KEY             = process.env.VAPI_API_KEY;
const VAPI_MORGAN_ASSISTANT_ID = process.env.VAPI_MORGAN_ASSISTANT_ID;
const VAPI_RILEY_ASSISTANT_ID  = process.env.VAPI_RILEY_ASSISTANT_ID || null;

// Support one or many phoneNumberIds for Vapi, comma-separated
// e.g. VAPI_PHONE_NUMBER_IDS=pn_123,pn_456
let vapiPhoneNumberIds = [];
if (process.env.VAPI_PHONE_NUMBER_IDS) {
  vapiPhoneNumberIds = process.env.VAPI_PHONE_NUMBER_IDS
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
} else if (process.env.VAPI_PHONE_NUMBER_ID) {
  vapiPhoneNumberIds = [process.env.VAPI_PHONE_NUMBER_ID.trim()];
}

let vapiPhoneNumberIndex = 0;

function getNextVapiPhoneNumberId() {
  if (!vapiPhoneNumberIds.length) {
    throw new Error(
      "No Vapi phoneNumberId configured. Set VAPI_PHONE_NUMBER_ID or VAPI_PHONE_NUMBER_IDS."
    );
  }
  const id = vapiPhoneNumberIds[vapiPhoneNumberIndex % vapiPhoneNumberIds.length];
  vapiPhoneNumberIndex += 1;
  return id;
}

function getAssistantIdForAgent(agentName, explicitAssistantId) {
  if (explicitAssistantId) return explicitAssistantId;

  const name = (agentName || "").toLowerCase();

  if (name === "morgan") return VAPI_MORGAN_ASSISTANT_ID;
  if (name === "riley") return VAPI_RILEY_ASSISTANT_ID;

  return null;
}

/**
 * PUBLIC: startOutboundCall
 *
 * @param {Object} args
 * @param {string} args.agentName - "Morgan" | "Riley" | etc.
 * @param {string} [args.assistantId] - Optional override assistant id
 * @param {string} args.toNumber - Customer phone number in E.164, e.g. "+13055551234"
 * @param {Object} [args.metadata] - Extra metadata object
 * @param {string} [args.callName] - Optional human label for the call
 *
 * @returns {Promise<{ provider: string, callId: string | null, raw: any }>}
 */
async function startOutboundCall({
  agentName,
  assistantId,
  toNumber,
  metadata = {},
  callName,
}) {
  if (!VAPI_API_KEY) {
    throw new Error("Missing VAPI_API_KEY env var");
  }

  if (!toNumber) {
    throw new Error("startOutboundCall requires toNumber");
  }

  const resolvedAssistantId = getAssistantIdForAgent(agentName, assistantId);
  if (!resolvedAssistantId) {
    throw new Error(
      `No Vapi assistantId resolved. Set VAPI_MORGAN_ASSISTANT_ID / VAPI_RILEY_ASSISTANT_ID or pass assistantId directly.`
    );
  }

  const phoneNumberId = getNextVapiPhoneNumberId();

  const payload = {
    assistantId: resolvedAssistantId,
    phoneNumberId,
    customer: {
      number: toNumber,
    },
    metadata,
    name: callName || `${agentName || "Agent"} Outbound Call`,
  };

  console.log("[voiceGateway] Vapi create call payload:", payload);

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
    console.error("[voiceGateway] Vapi create call error:", response.status, text);
    throw new Error("Vapi create call failed");
  }

  const data = await response.json();
  console.log("[voiceGateway] Vapi create call response:", JSON.stringify(data).slice(0, 500));

  return {
    provider: "vapi",
    callId: data.id || null,
    raw: data,
  };
}

// IMPORTANT: this is what index.js imports
module.exports = {
  startOutboundCall,
};
