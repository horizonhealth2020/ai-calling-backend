---
phase: quick
plan: 260330-jfj
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/ops-api/src/services/auditQueue.ts
  - apps/ops-api/src/services/__tests__/auditQueue.test.ts
autonomous: true
requirements: [QUICK-260330-JFJ]

must_haves:
  truths:
    - "Invalid audio buffers (HTML error pages, empty content, corrupted data) are detected before sending to Whisper"
    - "Valid audio formats (WAV, MP3, OGG, FLAC, WebM) pass validation and proceed to transcription"
    - "When an invalid buffer is detected, the system retries the download (the recording may not be ready yet)"
    - "After all retries exhausted with invalid audio, the job fails with a clear error message"
  artifacts:
    - path: "apps/ops-api/src/services/auditQueue.ts"
      provides: "Audio buffer validation with magic byte checking and retry logic"
      contains: "isValidAudioBuffer"
    - path: "apps/ops-api/src/services/__tests__/auditQueue.test.ts"
      provides: "Unit tests for audio buffer validation"
      contains: "isValidAudioBuffer"
  key_links:
    - from: "downloadRecordingWithRetry"
      to: "isValidAudioBuffer"
      via: "validation call after buffer download, before return"
      pattern: "isValidAudioBuffer.*buffer"
---

<objective>
Add audio buffer validation to the audit queue's recording download flow. Before sending a downloaded buffer to Whisper for transcription, validate that it contains actual audio data by checking magic bytes. If the buffer contains invalid data (e.g., an HTML error page from CDN, corrupted file, or placeholder content), retry the download since the recording may not be ready yet.

Purpose: Prevent wasted Whisper API calls and failed audits when recordings return non-audio content (CDN error pages, incomplete uploads, etc.).
Output: Updated auditQueue.ts with magic byte validation, unit tests confirming behavior.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/ops-api/src/services/auditQueue.ts
@apps/ops-api/src/services/callAudit.ts
@apps/ops-api/jest.config.ts

<interfaces>
From apps/ops-api/src/services/auditQueue.ts:
```typescript
// downloadRecordingWithRetry is the target function (private, called by runJob)
// It downloads recording, checks for empty buffer, and returns Buffer
// Currently at line 214-262
async function downloadRecordingWithRetry(callLogId: string, url: string): Promise<Buffer>

// Constants governing retry behavior:
const RECORDING_MAX_RETRIES = 10;
const RECORDING_RETRY_DELAY_MS = 60_000; // 60 seconds
```

From apps/ops-api/src/services/callAudit.ts:
```typescript
// transcribeRecording receives the Buffer and sends to Whisper
async function transcribeRecording(audioBuffer: Buffer): Promise<string>
// It creates a Blob from the buffer and POSTs to WHISPER_API_URL as FormData
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add isValidAudioBuffer helper and unit tests</name>
  <files>apps/ops-api/src/services/auditQueue.ts, apps/ops-api/src/services/__tests__/auditQueue.test.ts</files>
  <behavior>
    - isValidAudioBuffer returns true for buffers starting with WAV magic bytes (RIFF....WAVE)
    - isValidAudioBuffer returns true for buffers starting with MP3 magic bytes (0xFF 0xFB, 0xFF 0xF3, 0xFF 0xF2, or ID3 tag)
    - isValidAudioBuffer returns true for buffers starting with OGG magic bytes (OggS)
    - isValidAudioBuffer returns true for buffers starting with FLAC magic bytes (fLaC)
    - isValidAudioBuffer returns true for buffers starting with WebM/Matroska magic bytes (0x1A 0x45 0xDF 0xA3)
    - isValidAudioBuffer returns false for buffers starting with HTML (<!DOCTYPE or <html)
    - isValidAudioBuffer returns false for buffers starting with JSON ({ or [)
    - isValidAudioBuffer returns false for buffers that are too small (< 256 bytes) to be real audio
    - isValidAudioBuffer returns false for random/unknown binary data with no recognized audio header
  </behavior>
  <action>
    1. Create the test file `apps/ops-api/src/services/__tests__/auditQueue.test.ts`. Import `isValidAudioBuffer` (will need to export it for testing). Write tests for each behavior listed above using real magic byte sequences in Buffer.from().

    2. In `apps/ops-api/src/services/auditQueue.ts`, add and export a function `isValidAudioBuffer(buffer: Buffer): boolean` that:
       - Returns false if buffer.length < 256 (too small to be real audio)
       - Checks the first 4-12 bytes against known audio format magic bytes:
         - WAV: bytes 0-3 = "RIFF" AND bytes 8-11 = "WAVE"
         - MP3 frame sync: bytes 0-1 = 0xFF 0xFB/0xF3/0xF2
         - MP3 ID3 tag: bytes 0-2 = "ID3"
         - OGG: bytes 0-3 = "OggS"
         - FLAC: bytes 0-3 = "fLaC"
         - WebM/Matroska: bytes 0-3 = 0x1A 0x45 0xDF 0xA3
       - Returns false if no magic bytes match (catches HTML error pages, JSON responses, corrupted data)
       - Log a warning with the first 16 bytes hex dump when returning false for debugging

    3. Run tests to verify all pass.
  </action>
  <verify>
    <automated>cd apps/ops-api && npx jest --testPathPattern="auditQueue" --verbose 2>&1 | tail -30</automated>
  </verify>
  <done>isValidAudioBuffer correctly identifies valid audio formats and rejects non-audio content. All tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Integrate validation into downloadRecordingWithRetry</name>
  <files>apps/ops-api/src/services/auditQueue.ts</files>
  <action>
    In `downloadRecordingWithRetry`, after the existing empty-buffer check (line ~236-243) and before the success log (line ~245), add audio magic byte validation:

    ```
    // After: if (buffer.length === 0) { ... }
    // Add:
    if (!isValidAudioBuffer(buffer)) {
      if (attempt < RECORDING_MAX_RETRIES) {
        console.log(`[auditQueue] Invalid audio buffer for ${callLogId} (${buffer.length} bytes, first bytes: ${buffer.subarray(0, 16).toString('hex')}), attempt ${attempt}/${RECORDING_MAX_RETRIES}, retrying in 60s...`);
        await sleep(RECORDING_RETRY_DELAY_MS);
        continue;
      }
      throw new Error(`Recording has invalid audio content after ${RECORDING_MAX_RETRIES} attempts (${buffer.length} bytes, header: ${buffer.subarray(0, 16).toString('hex')})`);
    }
    ```

    This follows the exact same retry pattern as the existing empty-buffer check. The error message includes buffer size and hex header for debugging in production logs.
  </action>
  <verify>
    <automated>cd apps/ops-api && npx tsc --noEmit --pretty 2>&1 | tail -10</automated>
  </verify>
  <done>downloadRecordingWithRetry validates audio magic bytes after download. Invalid buffers trigger retry with the same delay/max-retry logic as empty buffers. TypeScript compiles without errors.</done>
</task>

</tasks>

<verification>
- `cd apps/ops-api && npx jest --testPathPattern="auditQueue" --verbose` -- all audio validation tests pass
- `cd apps/ops-api && npx tsc --noEmit` -- no type errors
- Grep for `isValidAudioBuffer` in auditQueue.ts confirms it is called inside `downloadRecordingWithRetry`
</verification>

<success_criteria>
- Audio buffers are validated against known magic bytes before being sent to Whisper
- Invalid buffers (HTML, JSON, too-small, unknown format) trigger retry with 60s delay
- After max retries with invalid audio, job fails with descriptive error including hex header
- All unit tests pass for the validation function
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/260330-jfj-add-audio-buffer-validation-to-audit-que/260330-jfj-SUMMARY.md`
</output>
