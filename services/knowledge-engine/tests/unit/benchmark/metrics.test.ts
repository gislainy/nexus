import { describe, it, expect } from "vitest";
import { MetricsCalculator } from "../../../src/benchmark/metrics.js";

const calc = new MetricsCalculator();

describe("MetricsCalculator", () => {
  it("Recall@10 = 1.0 when all relevant are in top-10", () => {
    const r = calc.calculate({
      queryId: "q",
      retrievedChunkIds: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
      relevantChunkIds: ["a", "b"],
    });
    expect(r.recallAt10).toBe(1);
  });

  it("Recall@10 = 0.5 when half of relevant are in top-10", () => {
    const r = calc.calculate({
      queryId: "q",
      retrievedChunkIds: ["a", "x", "y", "z", "1", "2", "3", "4", "5", "6"],
      relevantChunkIds: ["a", "b"],
    });
    expect(r.recallAt10).toBe(0.5);
  });

  it("MRR = 1.0 when first result is relevant", () => {
    const r = calc.calculate({
      queryId: "q",
      retrievedChunkIds: ["a", "b"],
      relevantChunkIds: ["a"],
    });
    expect(r.mrr).toBe(1);
  });

  it("MRR = 0.5 when second result is the first relevant", () => {
    const r = calc.calculate({
      queryId: "q",
      retrievedChunkIds: ["x", "a"],
      relevantChunkIds: ["a"],
    });
    expect(r.mrr).toBe(0.5);
  });

  it("MRR = 0 when no relevant in top-10", () => {
    const r = calc.calculate({
      queryId: "q",
      retrievedChunkIds: ["x", "y", "z", "1", "2", "3", "4", "5", "6", "7"],
      relevantChunkIds: ["a"],
    });
    expect(r.mrr).toBe(0);
  });

  it("NDCG@10 = 1 for ideal ranking", () => {
    const r = calc.calculate({
      queryId: "q",
      retrievedChunkIds: ["a", "b", "x", "y"],
      relevantChunkIds: ["a", "b"],
    });
    expect(r.ndcgAt10).toBeCloseTo(1, 10);
  });

  it("NDCG@10 < 1 for partially-relevant ranking", () => {
    const r = calc.calculate({
      queryId: "q",
      retrievedChunkIds: ["x", "a", "y", "b"],
      relevantChunkIds: ["a", "b"],
    });
    // DCG = 1/log2(3) + 1/log2(5)
    const dcg = 1 / Math.log2(3) + 1 / Math.log2(5);
    const idcg = 1 / Math.log2(2) + 1 / Math.log2(3);
    expect(r.ndcgAt10).toBeCloseTo(dcg / idcg, 10);
    expect(r.ndcgAt10).toBeLessThan(1);
  });

  it("NDCG@10 = 0 when no relevant retrieved", () => {
    const r = calc.calculate({
      queryId: "q",
      retrievedChunkIds: ["x", "y"],
      relevantChunkIds: ["a"],
    });
    expect(r.ndcgAt10).toBe(0);
  });

  it("aggregate computes mean over multiple results", () => {
    const r = calc.aggregate([
      { recallAt10: 1, mrr: 1, ndcgAt10: 1 },
      { recallAt10: 0, mrr: 0, ndcgAt10: 0 },
    ]);
    expect(r.recallAt10).toBe(0.5);
    expect(r.mrr).toBe(0.5);
    expect(r.ndcgAt10).toBe(0.5);
  });
});
