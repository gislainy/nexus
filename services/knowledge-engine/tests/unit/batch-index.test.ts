import { describe, expect, it, vi } from "vitest";
import {
  runBatchIndex,
  type Manifest,
} from "../../scripts/batch-index.js";

function makeEntry(overrides: Partial<Manifest["papers"][0]> = {}) {
  return {
    title: "Sample Paper",
    authors: ["A. Author"],
    year: 2024,
    venue: "Sample Venue",
    submodulePath: "core/sample.pdf",
    pdfHash: "deadbeef",
    accessType: "open" as const,
    layer: "core" as const,
    tags: ["TECHNICAL_JUSTIFICATION"],
    textFile: "core/sample.txt",
    ...overrides,
  };
}

describe("runBatchIndex", () => {
  it("indexes all papers when textFiles exist", async () => {
    const indexPaper = vi
      .fn()
      .mockResolvedValueOnce({ paperId: "p1", chunksCreated: 10 })
      .mockResolvedValueOnce({ paperId: "p2", chunksCreated: 12 });

    const manifest: Manifest = {
      papers: [
        makeEntry({ title: "P1", textFile: "p1.txt" }),
        makeEntry({ title: "P2", textFile: "p2.txt" }),
      ],
    };

    const logs: string[] = [];
    const result = await runBatchIndex(manifest, {
      indexing: { indexPaper },
      baseDir: "/base",
      readFile: () => "text",
      exists: () => true,
      log: (m) => logs.push(m),
    });

    expect(result).toEqual({ indexed: 2, totalChunks: 22, skipped: 0 });
    expect(indexPaper).toHaveBeenCalledTimes(2);
    expect(logs.some((l) => l.includes("[1/2] Indexing: P1"))).toBe(true);
    expect(logs.some((l) => l.includes("[2/2] Indexing: P2"))).toBe(true);
  });

  it("skips entries whose textFile is missing", async () => {
    const indexPaper = vi
      .fn()
      .mockResolvedValueOnce({ paperId: "p1", chunksCreated: 5 });

    const manifest: Manifest = {
      papers: [
        makeEntry({ title: "Present", textFile: "present.txt" }),
        makeEntry({ title: "Missing", textFile: "missing.txt" }),
      ],
    };

    const logs: string[] = [];
    const result = await runBatchIndex(manifest, {
      indexing: { indexPaper },
      baseDir: "/base",
      readFile: () => "text",
      exists: (p) => p.endsWith("present.txt"),
      log: (m) => logs.push(m),
    });

    expect(result).toEqual({ indexed: 1, totalChunks: 5, skipped: 1 });
    expect(indexPaper).toHaveBeenCalledTimes(1);
    expect(
      logs.some((l) => l.includes("[SKIP] Missing — textFile not found")),
    ).toBe(true);
  });
});
