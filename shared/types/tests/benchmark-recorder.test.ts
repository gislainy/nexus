import { describe, expect, it, vi } from "vitest";
import { BenchmarkRecorder } from "../src/benchmark-recorder.js";
import type { LLMProvider } from "../src/llm.js";

class FakeProvider implements LLMProvider {
  readonly name = "fake/model";
  async complete(prompt: string) {
    return {
      text: `echo:${prompt}`,
      model: "fake/model",
      promptTokens: 3,
      completionTokens: 4,
      latencyMs: 7,
    };
  }
  async embed(_: string) {
    return [0.1, 0.2, 0.3];
  }
}

describe("BenchmarkRecorder", () => {
  it("records every complete() call", async () => {
    const create = vi.fn().mockResolvedValue({});
    const prisma = { lLMBenchmarkRecord: { create } };
    const wrapped = BenchmarkRecorder.wrap(new FakeProvider(), prisma, {
      component: "C2",
      task: "artifact_extraction",
      experimentId: "00000000-0000-0000-0000-000000000099",
    });

    const result = await wrapped.complete("hi");
    expect(result.text).toBe("echo:hi");
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0]?.[0]?.data;
    expect(data.provider).toBe("fake/model");
    expect(data.component).toBe("C2");
    expect(data.task).toBe("artifact_extraction");
    expect(data.prompt).toBe("hi");
    expect(data.response).toBe("echo:hi");
    expect(data.tokensIn).toBe(3);
    expect(data.tokensOut).toBe(4);
    expect(data.latencyMs).toBe(7);
    expect(data.experimentId).toBe("00000000-0000-0000-0000-000000000099");
  });

  it("records embed() calls under a derived task name", async () => {
    const create = vi.fn().mockResolvedValue({});
    const prisma = { lLMBenchmarkRecord: { create } };
    const wrapped = BenchmarkRecorder.wrap(new FakeProvider(), prisma, {
      component: "C4",
      task: "rag_retrieval",
    });
    const vec = await wrapped.embed("text");
    expect(vec.length).toBe(3);
    const data = create.mock.calls[0]?.[0]?.data;
    expect(data.task).toBe("rag_retrieval:embed");
    expect(data.response).toBe("vector(3)");
    expect(data.experimentId).toBeNull();
  });

  it("does not break the underlying call if persistence fails", async () => {
    const create = vi.fn().mockRejectedValue(new Error("db down"));
    const prisma = { lLMBenchmarkRecord: { create } };
    const wrapped = BenchmarkRecorder.wrap(new FakeProvider(), prisma, {
      component: "C2",
      task: "t",
    });
    const result = await wrapped.complete("hello");
    expect(result.text).toBe("echo:hello");
  });
});
