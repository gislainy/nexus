import { describe, it, expect } from "vitest";
import { HybridRetrievalService } from "../../src/services/retrieval/hybrid.js";

describe("HybridRetrievalService.fuse (RRF)", () => {
  it("computes correct RRF scores for k=60 with known rankings", () => {
    const dense = [
      { chunkId: "A", score: 0.9 },
      { chunkId: "B", score: 0.7 },
    ];
    const sparse = [
      { chunkId: "B", score: 5.0 },
      { chunkId: "A", score: 3.0 },
    ];
    const out = HybridRetrievalService.fuse(dense, sparse, 10, 60);
    const a = out.find((c) => c.chunkId === "A")!;
    const b = out.find((c) => c.chunkId === "B")!;
    // A: rank 1 dense + rank 2 sparse = 1/61 + 1/62
    expect(a.score).toBeCloseTo(1 / 61 + 1 / 62, 10);
    // B: rank 2 dense + rank 1 sparse = 1/62 + 1/61
    expect(b.score).toBeCloseTo(1 / 62 + 1 / 61, 10);
  });

  it("documents present in only one ranking receive partial contribution", () => {
    const dense = [{ chunkId: "X", score: 0.9 }];
    const sparse = [{ chunkId: "Y", score: 5.0 }];
    const out = HybridRetrievalService.fuse(dense, sparse, 10, 60);
    const x = out.find((c) => c.chunkId === "X")!;
    const y = out.find((c) => c.chunkId === "Y")!;
    expect(x.score).toBeCloseTo(1 / 61, 10);
    expect(y.score).toBeCloseTo(1 / 61, 10);
  });

  it("respects topK truncation", () => {
    const dense = [
      { chunkId: "A", score: 1 },
      { chunkId: "B", score: 1 },
      { chunkId: "C", score: 1 },
    ];
    const sparse: Array<{ chunkId: string; score: number }> = [];
    const out = HybridRetrievalService.fuse(dense, sparse, 2, 60);
    expect(out.length).toBe(2);
  });
});
