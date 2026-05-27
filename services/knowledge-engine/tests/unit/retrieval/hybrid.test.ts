import { describe, it, expect } from "vitest";
import { HybridRetrievalService } from "../../../src/services/retrieval/hybrid.js";

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

  it("sparse-only candidate receives its sparse contribution", () => {
    const dense = [{ chunkId: "X", score: 0.9 }];
    const sparse = [{ chunkId: "Y", score: 5.0 }];
    const out = HybridRetrievalService.fuse(dense, sparse, 10, 60);
    const x = out.find((c) => c.chunkId === "X")!;
    expect(x.score).toBeCloseTo(1 / 61, 10);
    const y = out.find((c) => c.chunkId === "Y")!;
    expect(y).toBeDefined();
    expect(y.score).toBeCloseTo(1 / 61, 10);
  });

  it("returns sparse-only candidates when dense is empty", () => {
    const sparse = [
      { chunkId: "S1", score: 3 },
      { chunkId: "S2", score: 2 },
    ];
    const out = HybridRetrievalService.fuse([], sparse, 3, 60);
    expect(out).toHaveLength(2);
    const s1 = out.find((c) => c.chunkId === "S1")!;
    const s2 = out.find((c) => c.chunkId === "S2")!;
    expect(s1.score).toBeCloseTo(1 / 61, 10);
    expect(s2.score).toBeCloseTo(1 / 62, 10);
  });

  it("returns [] only when both dense and sparse are empty", () => {
    expect(HybridRetrievalService.fuse([], [], 5, 60)).toEqual([]);
  });

  it("includes sparse-only candidates alongside dense candidates", () => {
    const dense = [
      { chunkId: "A", score: 0.82 },
      { chunkId: "B", score: 0.71 },
      { chunkId: "C", score: 0.55 },
    ];
    const sparse = [
      { chunkId: "B", score: 3.2 },
      { chunkId: "D", score: 2.8 },
      { chunkId: "A", score: 1.1 },
    ];
    const out = HybridRetrievalService.fuse(dense, sparse, 4, 60);
    const d = out.find((c) => c.chunkId === "D");
    expect(d).toBeDefined();
    expect(d!.score).toBeCloseTo(1 / 62, 10);
    expect(out[0]!.chunkId).toBe("B");
    expect(out[1]!.chunkId).toBe("A");
  });

  it("sums RRF contributions when chunk appears in both lists", () => {
    const out = HybridRetrievalService.fuse(
      [{ chunkId: "A", score: 0.9 }],
      [{ chunkId: "A", score: 1.0 }],
      1,
      60,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.score).toBeCloseTo(2 / 61, 10);
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
