// voiceGateway.js

// --- Vapi env vars ---
const VAPI_API_KEY             = process.env.VAPI_API_KEY;
const VAPI_MORGAN_ASSISTANT_ID = process.env.VAPI_MORGAN_ASSISTANT_ID;
const VAPI_RILEY_ASSISTANT_ID  = process.env.VAPI_RILEY_ASSISTANT_ID || null;

// Support one or many phoneNumberIds for Vapi, comma-separated
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

// 🔧 Helper to normalize any phone input to E.164 (US default)
function normalizeToE164(raw) {
  if (!raw) return null;

  let s = String(raw).trim();

  // Remove everything except digits and +
  s = s.replace(/[^\d+]/g, "");

  // If it starts with + and has at least 8–10 digits, assume it's already E.164-ish
  if (s.startsWith("+")) {
    return s;
  }

  // Otherwise assume US and prepend +1
  const digitsOnly = s.replace(/\D/g, "");
  if (!digitsOnly) return null;

  return "+1" + digitsOnly;
}

/**
 * PUBLIC: startOutboundCall
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

  // ⬇️ Normalize here no matter what the caller passes
  const customerNumber = normalizeToE164(toNumber);
  if (!customerNumber) {
    throw new Error(`Invalid toNumber: "${toNumber}" could not be normalized to E.164`);
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
      number: customerNumber,
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

module.exports = {
  startOutboundCall,
};
