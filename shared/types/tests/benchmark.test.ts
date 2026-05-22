import { describe, expect, it } from "vitest";
import {
  BenchmarkExperiment,
  BenchmarkRun,
  LLMBenchmarkRecord,
} from "../src/benchmark.js";

const UUID = "00000000-0000-0000-0000-000000000050";

describe("Benchmark schemas", () => {
  it("accepts a valid LLMBenchmarkRecord", () => {
    const ok = LLMBenchmarkRecord.safeParse({
      id: UUID,
      provider: "ollama/llama3.2",
      component: "C2",
      task: "artifact_extraction",
      prompt: "p",
      response: "r",
      latencyMs: 100,
      tokensIn: 10,
      tokensOut: 20,
      timestamp: new Date(),
    });
    expect(ok.success).toBe(true);
  });

  it("rejects negative latency", () => {
    const bad = LLMBenchmarkRecord.safeParse({
      id: UUID,
      provider: "x",
      component: "C2",
      task: "t",
      prompt: "p",
      response: "r",
      latencyMs: -1,
      tokensIn: 0,
      tokensOut: 0,
      timestamp: new Date(),
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a valid experiment and run", () => {
    expect(
      BenchmarkExperiment.safeParse({
        id: UUID,
        name: "exp",
        description: "",
        component: "C5",
        task: "argument_expression",
        candidateModels: ["ollama/llama3.2"],
        testPrompts: [{ id: "p1", input: "hello" }],
        evaluationCriteria: {
          primaryMetric: "rougeL",
          secondaryMetrics: [],
          method: "MANUAL",
          minimumAcceptableScore: 0.5,
        },
        status: "PLANNED",
        createdAt: new Date(),
      }).success,
    ).toBe(true);

    expect(
      BenchmarkRun.safeParse({
        id: UUID,
        experimentId: UUID,
        promptId: "p1",
        provider: "ollama/llama3.2",
        response: "r",
        latencyMs: 100,
        tokensIn: 10,
        tokensOut: 5,
        evaluationScore: 0.8,
        evaluationMethod: "MANUAL",
        ranAt: new Date(),
      }).success,
    ).toBe(true);
  });

  it("rejects an experiment with no candidates", () => {
    const bad = BenchmarkExperiment.safeParse({
      id: UUID,
      name: "exp",
      description: "",
      component: "C5",
      task: "t",
      candidateModels: [],
      testPrompts: [{ id: "p1", input: "x" }],
      evaluationCriteria: {
        primaryMetric: "m",
        secondaryMetrics: [],
        method: "MANUAL",
        minimumAcceptableScore: 0.5,
      },
      status: "PLANNED",
      createdAt: new Date(),
    });
    expect(bad.success).toBe(false);
  });
});
