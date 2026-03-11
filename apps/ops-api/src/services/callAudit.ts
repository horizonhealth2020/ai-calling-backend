import { prisma } from "@ops/db";
import OpenAI from "openai";

const DEFAULT_AUDIT_PROMPT = `You are a call quality auditor. Analyze the following call transcription and provide:
1. A score from 0-100 based on: professionalism, script adherence, objection handling, closing technique, and compliance
2. A brief summary of the call (2-3 sentences)
3. Specific coaching notes for the agent

Respond in JSON format: {"score": number, "summary": "string", "coachingNotes": "string"}`;

async function transcribeRecording(recordingUrl: string): Promise<string> {
  const whisperUrl = process.env.WHISPER_API_URL;
  if (!whisperUrl) throw new Error("WHISPER_API_URL not configured");

  // Download recording
  const recordingRes = await fetch(recordingUrl);
  if (!recordingRes.ok) throw new Error(`Failed to download recording: ${recordingRes.status}`);
  const buffer = Buffer.from(await recordingRes.arrayBuffer());

  // Send to self-hosted Whisper
  const formData = new FormData();
  formData.append("file", new Blob([buffer]), "recording.mp3");

  const whisperRes = await fetch(whisperUrl, { method: "POST", body: formData });
  if (!whisperRes.ok) throw new Error(`Whisper transcription failed: ${whisperRes.status}`);

  const result = await whisperRes.json();
  // Common Whisper server response shapes
  return result.text ?? result.transcription ?? result.result ?? "";
}

async function auditTranscription(transcription: string, systemPrompt: string): Promise<{ score: number; summary: string; coachingNotes: string }> {
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

export async function processCallRecording(callLogId: string): Promise<void> {
  try {
    const callLog = await prisma.convosoCallLog.findUnique({ where: { id: callLogId } });
    if (!callLog || !callLog.recordingUrl) return;

    // Update status to transcribing
    await prisma.convosoCallLog.update({ where: { id: callLogId }, data: { auditStatus: "transcribing" } });

    // Transcribe
    const transcription = await transcribeRecording(callLog.recordingUrl);
    await prisma.convosoCallLog.update({ where: { id: callLogId }, data: { transcription, auditStatus: "auditing" } });

    // Load system prompt from settings
    const setting = await prisma.salesBoardSetting.findUnique({ where: { key: "ai_audit_system_prompt" } });
    const systemPrompt = setting?.value ?? DEFAULT_AUDIT_PROMPT;

    // Run AI audit
    const audit = await auditTranscription(transcription, systemPrompt);

    // Create CallAudit record (no reviewer for AI-generated audits)
    const callAudit = await prisma.callAudit.create({
      data: {
        agentId: callLog.agentId!,
        callDate: callLog.callTimestamp,
        score: audit.score,
        status: "ai_reviewed",
        coachingNotes: audit.coachingNotes,
        transcription,
        aiSummary: audit.summary,
        aiScore: audit.score,
        aiCoachingNotes: audit.coachingNotes,
        recordingUrl: callLog.recordingUrl,
      },
    });

    // Link call log to audit
    await prisma.convosoCallLog.update({
      where: { id: callLogId },
      data: { callAuditId: callAudit.id, auditStatus: "complete" },
    });
  } catch (err) {
    console.error(`[callAudit] Failed to process call ${callLogId}:`, err);
    await prisma.convosoCallLog.update({
      where: { id: callLogId },
      data: { auditStatus: "failed" },
    }).catch(() => {});
  }
}
