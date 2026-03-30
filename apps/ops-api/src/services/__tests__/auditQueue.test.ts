import { isValidAudioBuffer } from "../auditQueue";

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
