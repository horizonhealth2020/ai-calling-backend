import { prisma } from "@ops/db";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { emitAuditStatus, emitAuditComplete } from "../socket";

// ── Tool definition for Claude structured output ────────────────
const auditTool: Anthropic.Tool = {
  name: "submit_call_audit",
  description:
    "Analyze a sales call transcript and identify specific coaching moments with direct quotes. Only cite what is explicitly present in the transcript.",
  input_schema: {
    type: "object" as const,
    required: [
      "agent_name",
      "call_outcome",
      "issues",
      "wins",
      "missed_opportunities",
      "suggested_coaching",
      "manager_summary",
    ],
    properties: {
      agent_name: { type: "string", description: "Name of the agent on the call" },
      call_outcome: {
        type: "string",
        enum: ["sold", "callback_scheduled", "lost", "not_qualified", "incomplete"],
        description: "Final outcome of the call",
      },
      call_duration_estimate: {
        type: "string",
        description: "Estimated call length: short (under 5 min), medium (5-15 min), long (15+ min)",
      },
      issues: {
        type: "array",
        description: "Specific problems identified in the call — limit to 3-5 most impactful",
        items: {
          type: "object",
          required: ["category", "what_happened", "agent_quote", "customer_quote", "why_its_a_problem", "recommended_response"],
          properties: {
            category: {
              type: "string",
              enum: [
                "missed_discovery", "weak_objection_handling", "missed_close_opportunity",
                "lost_control", "poor_rebuttal", "no_urgency", "no_tie_down",
                "talked_too_much", "didnt_listen", "compliance_concern",
                "pricing_issue", "rapport_failure",
              ],
              description: "Category of the issue",
            },
            timestamp_hint: { type: "string", description: "Approximate location in call: early, mid, late, or after specific event" },
            what_happened: { type: "string", description: "Brief factual description of the moment (1-2 sentences)" },
            agent_quote: { type: "string", description: "Exact quote from agent. Use 'No direct quote available' if not in transcript." },
            customer_quote: { type: "string", description: "Customer statement that triggered this or their response. Use 'No direct quote available' if not in transcript." },
            why_its_a_problem: { type: "string", description: "Why this hurt the call (1-2 sentences)" },
            recommended_response: { type: "string", description: "What the agent should have said instead — specific script language" },
          },
        },
      },
      wins: {
        type: "array",
        description: "Things the agent did well — include 1-2 if they exist",
        items: {
          type: "object",
          required: ["what_happened", "agent_quote", "why_it_worked"],
          properties: {
            what_happened: { type: "string", description: "What the agent did well" },
            agent_quote: { type: "string", description: "Exact quote demonstrating the good behavior" },
            why_it_worked: { type: "string", description: "Why this was effective" },
          },
        },
      },
      missed_opportunities: {
        type: "array",
        description: "Moments where something should have been said but wasn't",
        items: {
          type: "object",
          required: ["moment", "what_should_have_happened", "suggested_script"],
          properties: {
            moment: { type: "string", description: "When in the call this should have happened" },
            what_should_have_happened: { type: "string", description: "What was missing" },
            suggested_script: { type: "string", description: "Exact language agent could have used" },
          },
        },
      },
      suggested_coaching: {
        type: "array",
        description: "Top 1-3 priorities for manager to address with agent",
        items: {
          type: "object",
          required: ["priority", "focus_area", "talking_point"],
          properties: {
            priority: { type: "integer", enum: [1, 2, 3], description: "Priority ranking" },
            focus_area: { type: "string", description: "Skill or behavior to focus on" },
            talking_point: { type: "string", description: "What the manager should say to the agent — conversational, direct, actionable" },
          },
        },
      },
      manager_summary: {
        type: "string",
        description: "2-3 sentence executive summary a manager can read in 10 seconds.",
      },
    },
  },
};

// ── Structured audit result type ────────────────────────────────
interface AuditResult {
  agent_name: string;
  call_outcome: string;
  call_duration_estimate?: string;
  issues: Array<{
    category: string;
    timestamp_hint?: string;
    what_happened: string;
    agent_quote: string;
    customer_quote: string;
    why_its_a_problem: string;
    recommended_response: string;
  }>;
  wins: Array<{
    what_happened: string;
    agent_quote: string;
    why_it_worked: string;
  }>;
  missed_opportunities: Array<{
    moment: string;
    what_should_have_happened: string;
    suggested_script: string;
  }>;
  suggested_coaching: Array<{
    priority: number;
    focus_area: string;
    talking_point: string;
  }>;
  manager_summary: string;
}

// ── Default prompt (used when no custom prompt is set) ──────────
const DEFAULT_AUDIT_PROMPT = `You are a call quality auditor. Analyze the following call transcription and provide:
1. A score from 0-100 based on: professionalism, script adherence, objection handling, closing technique, and compliance
2. A brief summary of the call (2-3 sentences)
3. Specific coaching notes for the agent

Respond in JSON format: {"score": number, "summary": "string", "coachingNotes": "string"}`;

// ── Transcription ───────────────────────────────────────────────
async function transcribeRecording(audioBuffer: Buffer): Promise<string> {
  const whisperUrl = process.env.WHISPER_API_URL;
  if (!whisperUrl) throw new Error("WHISPER_API_URL not configured");

  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer as unknown as BlobPart]), "recording.mp3");

  const whisperRes = await fetch(whisperUrl, { method: "POST", body: formData });
  if (!whisperRes.ok) throw new Error(`Whisper transcription failed: ${whisperRes.status}`);

  const result = await whisperRes.json();
  return result.text ?? result.transcription ?? result.result ?? "";
}

// ── Claude audit (primary) ──────────────────────────────────────
async function auditWithClaude(transcription: string, systemPrompt: string, agentName: string): Promise<{ result: AuditResult; usage: { inputTokens: number; outputTokens: number; model: string } }> {
  const anthropic = new Anthropic();
  const model = "claude-sonnet-4-20250514";

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    tools: [auditTool],
    tool_choice: { type: "tool", name: "submit_call_audit" },
    messages: [
      {
        role: "user",
        content: `Audit the following sales call transcript. The agent's name is ${agentName}.\n\n--- TRANSCRIPT START ---\n${transcription}\n--- TRANSCRIPT END ---`,
      },
    ],
  });

  const toolUseBlock = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!toolUseBlock) throw new Error("No tool use in Claude response");

  return {
    result: toolUseBlock.input as unknown as AuditResult,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      model,
    },
  };
}

// ── Derive numeric score from structured audit ──────────────────
function deriveScore(result: AuditResult): number {
  const baseScores: Record<string, number> = {
    sold: 85,
    callback_scheduled: 60,
    lost: 40,
    not_qualified: 50,
    incomplete: 30,
  };
  let score = baseScores[result.call_outcome] ?? 50;
  score -= result.issues.length * 5;
  score += result.wins.length * 5;
  return Math.max(0, Math.min(100, score));
}

// ── Flatten coaching for legacy fields ──────────────────────────
function flattenCoaching(result: AuditResult): string {
  if (!result.suggested_coaching.length) return "";
  return result.suggested_coaching
    .sort((a, b) => a.priority - b.priority)
    .map((c) => `P${c.priority} - ${c.focus_area}: ${c.talking_point}`)
    .join("\n\n");
}

// ── Legacy OpenAI audit (fallback) ──────────────────────────────
async function auditWithOpenAI(transcription: string, systemPrompt: string): Promise<{ score: number; summary: string; coachingNotes: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcription },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty GPT response");

  const parsed = JSON.parse(content);
  return {
    score: typeof parsed.score === "number" ? parsed.score : 50,
    summary: parsed.summary ?? "",
    coachingNotes: parsed.coachingNotes ?? "",
  };
}

// ── Usage info returned to caller for cost tracking ─────────────
export interface AuditUsageInfo {
  inputTokens: number;
  outputTokens: number;
  model: string;
  estimatedCost: number;
}

// ── Cost estimation helpers ─────────────────────────────────────
function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Claude Sonnet: $3/M input, $15/M output
  if (model.includes("claude")) {
    return (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
  }
  // GPT-4o-mini: $0.15/M input, $0.60/M output
  return (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;
}

// ── Main processing pipeline ────────────────────────────────────
export async function processCallRecording(callLogId: string, audioBuffer: Buffer): Promise<AuditUsageInfo | void> {
  try {
    const callLog = await prisma.convosoCallLog.findUnique({
      where: { id: callLogId },
      include: { agent: true },
    });
    if (!callLog) return;

    const agentName = callLog.agent?.name ?? callLog.agentUser;

    // Step 1: Transcribe
    emitAuditStatus({ callLogId, status: "transcribing" });
    await prisma.convosoCallLog.update({ where: { id: callLogId }, data: { auditStatus: "transcribing" } });

    const transcription = await transcribeRecording(audioBuffer);
    await prisma.convosoCallLog.update({ where: { id: callLogId }, data: { transcription, auditStatus: "auditing" } });

    // Step 2: Load system prompt
    const setting = await prisma.salesBoardSetting.findUnique({ where: { key: "ai_audit_system_prompt" } });
    const systemPrompt = setting?.value ?? DEFAULT_AUDIT_PROMPT;

    // Step 3: Audit — prefer Claude, fall back to OpenAI
    emitAuditStatus({ callLogId, status: "auditing" });

    const useClaude = !!process.env.ANTHROPIC_API_KEY;
    let callAudit;
    let usageInfo: AuditUsageInfo | undefined;

    if (useClaude) {
      const { result, usage } = await auditWithClaude(transcription, systemPrompt, agentName);
      const score = deriveScore(result);
      usageInfo = {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        model: usage.model,
        estimatedCost: estimateCost(usage.model, usage.inputTokens, usage.outputTokens),
      };

      callAudit = await prisma.callAudit.create({
        data: {
          agentId: callLog.agentId!,
          callDate: callLog.callTimestamp,
          score,
          status: "ai_reviewed",
          coachingNotes: flattenCoaching(result),
          transcription,
          recordingUrl: callLog.recordingUrl,
          // Legacy fields (backward compat)
          aiScore: score,
          aiSummary: result.manager_summary,
          aiCoachingNotes: flattenCoaching(result),
          // New structured fields
          callOutcome: result.call_outcome,
          callDurationEstimate: result.call_duration_estimate,
          issues: result.issues as any,
          wins: result.wins as any,
          missedOpportunities: result.missed_opportunities as any,
          suggestedCoaching: result.suggested_coaching as any,
          managerSummary: result.manager_summary,
        },
      });
    } else {
      // OpenAI fallback — legacy fields only
      const audit = await auditWithOpenAI(transcription, systemPrompt);
      callAudit = await prisma.callAudit.create({
        data: {
          agentId: callLog.agentId!,
          callDate: callLog.callTimestamp,
          score: audit.score,
          status: "ai_reviewed",
          coachingNotes: audit.coachingNotes,
          transcription,
          recordingUrl: callLog.recordingUrl,
          aiSummary: audit.summary,
          aiScore: audit.score,
          aiCoachingNotes: audit.coachingNotes,
        },
      });
    }

    // Step 4: Link call log to audit
    await prisma.convosoCallLog.update({
      where: { id: callLogId },
      data: { callAuditId: callAudit.id, auditStatus: "complete" },
    });

    // Step 5: Notify dashboard
    const auditForDashboard = await prisma.callAudit.findUnique({
      where: { id: callAudit.id },
      include: { agent: { select: { name: true } } },
    });
    emitAuditComplete(auditForDashboard);

    console.log(`[callAudit] Audit complete for call log ${callLogId} (${useClaude ? "Claude" : "OpenAI"})`);
    return usageInfo;
  } catch (err) {
    console.error(`[callAudit] Failed to process call ${callLogId}:`, err);
    await prisma.convosoCallLog.update({
      where: { id: callLogId },
      data: { auditStatus: "failed" },
    }).catch(() => {});
    throw err; // Re-throw so auditQueue can handle it
  }
}

// ── Re-audit an existing transcription ──────────────────────────
export async function reAuditCall(callAuditId: string): Promise<void> {
  const existing = await prisma.callAudit.findUnique({
    where: { id: callAuditId },
    include: { agent: true },
  });
  if (!existing?.transcription) throw new Error("No transcription to re-audit");

  const setting = await prisma.salesBoardSetting.findUnique({ where: { key: "ai_audit_system_prompt" } });
  const systemPrompt = setting?.value ?? DEFAULT_AUDIT_PROMPT;
  const agentName = existing.agent?.name ?? "Unknown";

  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY required for re-audit");

  const { result } = await auditWithClaude(existing.transcription, systemPrompt, agentName);
  const score = deriveScore(result);

  await prisma.callAudit.update({
    where: { id: callAuditId },
    data: {
      score,
      aiScore: score,
      aiSummary: result.manager_summary,
      aiCoachingNotes: flattenCoaching(result),
      coachingNotes: flattenCoaching(result),
      callOutcome: result.call_outcome,
      callDurationEstimate: result.call_duration_estimate,
      issues: result.issues as any,
      wins: result.wins as any,
      missedOpportunities: result.missed_opportunities as any,
      suggestedCoaching: result.suggested_coaching as any,
      managerSummary: result.manager_summary,
    },
  });
}
