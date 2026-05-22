import { describe, it, expect } from "vitest";
import { getEncoding } from "js-tiktoken";
import { ChunkingService } from "../../src/services/chunking.js";

const enc = getEncoding("cl100k_base");

function makeTextOfTokens(n: number): string {
  // "word" tokenizes reliably; use distinct tokens by varying numbers
  const words: string[] = [];
  for (let i = 0; i < n * 2; i++) words.push(`word${i}`);
  // Trim to exact token count
  let text = words.join(" ");
  while (enc.encode(text).length > n) {
    text = text.slice(0, text.lastIndexOf(" "));
  }
  return text;
}

describe("ChunkingService", () => {
  it("splits 1000-token text into expected chunks (size=512, overlap=64)", () => {
    const text = makeTextOfTokens(1000);
    const svc = new ChunkingService({ chunkSize: 512, overlap: 64 });
    const chunks = svc.chunk(text);
    // step = 448. windows starting at 0, 448, 896. Last window 896..1000 = 104 tokens (>=50) → kept.
    expect(chunks.length).toBe(3);
  });

  it("drops final window when smaller than 50 tokens", () => {
    const text = makeTextOfTokens(540);
    const svc = new ChunkingService({ chunkSize: 512, overlap: 64 });
    const chunks = svc.chunk(text);
    // 1st window: 0..512. next start = 448, window 448..540 = 92 tokens → kept.
    expect(chunks.length).toBe(2);

    const text2 = makeTextOfTokens(460);
    const svc2 = new ChunkingService({ chunkSize: 512, overlap: 64 });
    const chunks2 = svc2.chunk(text2);
    // single window of 460 tokens, kept (>=50)
    expect(chunks2.length).toBe(1);

    const tiny = makeTextOfTokens(30);
    const chunks3 = svc2.chunk(tiny);
    expect(chunks3.length).toBe(0);
  });

  it("each chunk text decodes to subset of original tokens", () => {
    const text = makeTextOfTokens(800);
    const svc = new ChunkingService({ chunkSize: 256, overlap: 32 });
    const chunks = svc.chunk(text);
    const originalTokens = enc.encode(text);
    for (const c of chunks) {
      const chunkTokens = enc.encode(c.text);
      expect(chunkTokens.length).toBeLessThanOrEqual(256);
      // every token id in chunk must appear in original (subset check via includes)
      const origSet = new Set(originalTokens);
      for (const t of chunkTokens) {
        expect(origSet.has(t)).toBe(true);
      }
    }
  });
});
