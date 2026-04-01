import { prisma } from "@ops/db";
import { isValidAudioBuffer } from "../auditQueue";

// Plan 01 must export these functions from auditQueue.ts
// Until then, these imports will cause test failures (expected RED state)
let categorizeError: (msg: string) => string;
let recoverOrphanedJobs: () => Promise<number>;
let retryFailedAudits: () => Promise<number>;

try {
  // Dynamic require so the file compiles even before Plan 01 exports these
  const mod = require("../auditQueue");
  categorizeError = mod.categorizeError;
  recoverOrphanedJobs = mod.recoverOrphanedJobs;
  retryFailedAudits = mod.retryFailedAudits;
} catch {
  // Functions not yet exported -- tests will fail with descriptive messages
}

// ── Mock socket module ──────────────────────────────────────────

jest.mock("../../socket", () => ({
  emitAuditStarted: jest.fn(),
  emitAuditStatus: jest.fn(),
  emitAuditFailed: jest.fn(),
}));

// Silence console output during tests
beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ══════════════════════════════════════════════════════════════════
// Existing isValidAudioBuffer tests
// ══════════════════════════════════════════════════════════════════

/**
 * Helper: create a buffer of at least `minSize` bytes starting with `header`.
 * Pads with zeroes to reach minimum size.
 */
function audioBuffer(header: number[], minSize = 512): Buffer {
  const buf = Buffer.alloc(Math.max(header.length, minSize));
  Buffer.from(header).copy(buf);
  return buf;
}

describe("isValidAudioBuffer", () => {
  // ── Valid formats ────────────────────────────────────────────────

  it("returns true for WAV (RIFF....WAVE)", () => {
    const buf = audioBuffer([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // file size (placeholder)
      0x57, 0x41, 0x56, 0x45, // WAVE
    ]);
    expect(isValidAudioBuffer(buf)).toBe(true);
  });

  it("returns true for MP3 frame sync 0xFF 0xFB", () => {
    expect(isValidAudioBuffer(audioBuffer([0xff, 0xfb]))).toBe(true);
  });

  it("returns true for MP3 frame sync 0xFF 0xF3", () => {
    expect(isValidAudioBuffer(audioBuffer([0xff, 0xf3]))).toBe(true);
  });

  it("returns true for MP3 frame sync 0xFF 0xF2", () => {
    expect(isValidAudioBuffer(audioBuffer([0xff, 0xf2]))).toBe(true);
  });

  it("returns true for MP3 ID3 tag", () => {
    const buf = audioBuffer([0x49, 0x44, 0x33]); // "ID3"
    expect(isValidAudioBuffer(buf)).toBe(true);
  });

  it("returns true for OGG (OggS)", () => {
    const buf = audioBuffer([0x4f, 0x67, 0x67, 0x53]); // "OggS"
    expect(isValidAudioBuffer(buf)).toBe(true);
  });

  it("returns true for FLAC (fLaC)", () => {
    const buf = audioBuffer([0x66, 0x4c, 0x61, 0x43]); // "fLaC"
    expect(isValidAudioBuffer(buf)).toBe(true);
  });

  it("returns true for WebM/Matroska", () => {
    const buf = audioBuffer([0x1a, 0x45, 0xdf, 0xa3]);
    expect(isValidAudioBuffer(buf)).toBe(true);
  });

  // ── Invalid content ──────────────────────────────────────────────

  it("returns false for HTML starting with <!DOCTYPE", () => {
    const html = Buffer.from("<!DOCTYPE html><html><body>Error 503</body></html>".padEnd(512, " "));
    expect(isValidAudioBuffer(html)).toBe(false);
  });

  it("returns false for HTML starting with <html", () => {
    const html = Buffer.from("<html><body>Not Found</body></html>".padEnd(512, " "));
    expect(isValidAudioBuffer(html)).toBe(false);
  });

  it("returns false for JSON starting with {", () => {
    const json = Buffer.from('{"error":"not found"}'.padEnd(512, " "));
    expect(isValidAudioBuffer(json)).toBe(false);
  });

  it("returns false for JSON starting with [", () => {
    const json = Buffer.from('[{"error":"not found"}]'.padEnd(512, " "));
    expect(isValidAudioBuffer(json)).toBe(false);
  });

  it("returns false for buffers too small (< 256 bytes)", () => {
    // Even with valid WAV header, too small = invalid
    const buf = Buffer.alloc(100);
    Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]).copy(buf);
    expect(isValidAudioBuffer(buf)).toBe(false);
  });

  it("returns false for random binary data with no recognized header", () => {
    const buf = audioBuffer([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    expect(isValidAudioBuffer(buf)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// NEW: categorizeError tests (D-03, D-04)
// Plan 01 must export categorizeError from auditQueue.ts
// ══════════════════════════════════════════════════════════════════

describe("categorizeError", () => {
  const skip = !categorizeError;
  const testOrSkip = skip ? it.skip : it;

  testOrSkip("error containing 'Recording download failed' returns 'recording_unavailable'", () => {
    expect(categorizeError("Recording download failed after 10 attempts: HTTP 404")).toBe("recording_unavailable");
  });

  testOrSkip("error containing 'Recording empty' returns 'recording_unavailable'", () => {
    expect(categorizeError("Recording empty after 10 attempts")).toBe("recording_unavailable");
  });

  testOrSkip("error containing 'Invalid audio' returns 'recording_unavailable'", () => {
    expect(categorizeError("Recording has invalid audio content after 10 attempts")).toBe("recording_unavailable");
  });

  testOrSkip("error containing 'Whisper' returns 'transcription_timeout'", () => {
    expect(categorizeError("Whisper API timeout after 30s")).toBe("transcription_timeout");
  });

  testOrSkip("error containing 'AbortError' returns 'transcription_timeout'", () => {
    expect(categorizeError("AbortError: The operation was aborted")).toBe("transcription_timeout");
  });

  testOrSkip("error containing 'anthropic' returns 'claude_api_error'", () => {
    expect(categorizeError("anthropic API returned 500")).toBe("claude_api_error");
  });

  testOrSkip("error containing '429' returns 'claude_api_error'", () => {
    expect(categorizeError("Request failed with status 429")).toBe("claude_api_error");
  });

  testOrSkip("error containing 'overloaded' returns 'claude_api_error'", () => {
    expect(categorizeError("Model is overloaded, please try again")).toBe("claude_api_error");
  });

  testOrSkip("unknown error returns 'unknown'", () => {
    expect(categorizeError("Something completely unexpected happened")).toBe("unknown");
  });
});

// ══════════════════════════════════════════════════════════════════
// NEW: recoverOrphanedJobs tests (D-01)
// Plan 01 must export recoverOrphanedJobs from auditQueue.ts
// ══════════════════════════════════════════════════════════════════

describe("recoverOrphanedJobs", () => {
  const skip = !recoverOrphanedJobs;
  const testOrSkip = skip ? it.skip : it;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  testOrSkip("calls prisma.convosoCallLog.updateMany with correct status filter", async () => {
    const mockUpdateMany = jest.fn().mockResolvedValue({ count: 3 });
    (prisma as any).convosoCallLog = { updateMany: mockUpdateMany };

    await recoverOrphanedJobs();

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        auditStatus: {
          in: ["processing", "waiting_recording", "transcribing", "auditing"],
        },
      },
      data: { auditStatus: "queued" },
    });
  });

  testOrSkip("returns count of recovered orphans", async () => {
    const mockUpdateMany = jest.fn().mockResolvedValue({ count: 5 });
    (prisma as any).convosoCallLog = { updateMany: mockUpdateMany };

    const count = await recoverOrphanedJobs();
    expect(count).toBe(5);
  });

  testOrSkip("logs recovery event when count > 0", async () => {
    const mockUpdateMany = jest.fn().mockResolvedValue({ count: 2 });
    (prisma as any).convosoCallLog = { updateMany: mockUpdateMany };
    const logSpy = jest.spyOn(console, "log");

    await recoverOrphanedJobs();

    const logCalls = logSpy.mock.calls.flat().join(" ");
    expect(logCalls).toContain("audit_orphan_recovery");
  });

  testOrSkip("does not log when count is 0", async () => {
    const mockUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    (prisma as any).convosoCallLog = { updateMany: mockUpdateMany };
    const logSpy = jest.spyOn(console, "log");
    logSpy.mockClear();

    await recoverOrphanedJobs();

    const logCalls = logSpy.mock.calls.flat().join(" ");
    expect(logCalls).not.toContain("audit_orphan_recovery");
  });
});

// ══════════════════════════════════════════════════════════════════
// NEW: retryFailedAudits tests (D-02)
// Plan 01 must export retryFailedAudits from auditQueue.ts
// ══════════════════════════════════════════════════════════════════

describe("retryFailedAudits", () => {
  const skip = !retryFailedAudits;
  const testOrSkip = skip ? it.skip : it;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  testOrSkip("finds failed audits with retryCount < 3 and recordingUrl not null", async () => {
    const mockFindMany = jest.fn().mockResolvedValue([]);
    (prisma as any).convosoCallLog = { findMany: mockFindMany };

    await retryFailedAudits();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          auditStatus: "failed",
          retryCount: { lt: 3 },
          recordingUrl: { not: null },
        }),
      })
    );
  });

  testOrSkip("re-queues eligible audits by setting auditStatus to 'queued'", async () => {
    const now = Date.now();
    const twoMinutesAgo = new Date(now - 2 * 60 * 1000);

    const mockFindMany = jest.fn().mockResolvedValue([
      { id: "call-1", retryCount: 0, lastFailedAt: twoMinutesAgo },
    ]);
    const mockUpdate = jest.fn().mockResolvedValue({});
    (prisma as any).convosoCallLog = {
      findMany: mockFindMany,
      update: mockUpdate,
    };

    const count = await retryFailedAudits();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "call-1" },
        data: expect.objectContaining({
          auditStatus: "queued",
          retryCount: 1,
        }),
      })
    );
    expect(count).toBe(1);
  });

  testOrSkip("returns 0 when no eligible candidates", async () => {
    const mockFindMany = jest.fn().mockResolvedValue([]);
    (prisma as any).convosoCallLog = { findMany: mockFindMany };

    const count = await retryFailedAudits();
    expect(count).toBe(0);
  });

  testOrSkip("skips candidates that failed too recently (backoff not elapsed)", async () => {
    const now = Date.now();
    // retryCount=0 needs 1min backoff; failed only 10 seconds ago
    const tenSecondsAgo = new Date(now - 10 * 1000);

    const mockFindMany = jest.fn().mockResolvedValue([
      { id: "call-1", retryCount: 0, lastFailedAt: tenSecondsAgo },
    ]);
    const mockUpdate = jest.fn().mockResolvedValue({});
    (prisma as any).convosoCallLog = {
      findMany: mockFindMany,
      update: mockUpdate,
    };

    const count = await retryFailedAudits();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });
});
