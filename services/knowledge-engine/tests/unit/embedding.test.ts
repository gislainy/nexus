import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  OllamaEmbeddingService,
  TransformersEmbeddingService,
} from "../../src/services/embedding.js";

vi.mock("@xenova/transformers", () => ({
  pipeline: vi.fn(),
}));

import { pipeline } from "@xenova/transformers";

describe("OllamaEmbeddingService", () => {
  it("POSTs to /api/embeddings with correct payload and returns vector", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ embedding: [0.1, 0.2, 0.3] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const svc = new OllamaEmbeddingService({
      baseUrl: "http://localhost:11434",
      model: "nomic-embed-text",
      dimension: 768,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const vec = await svc.embed("hello");
    expect(vec).toEqual([0.1, 0.2, 0.3]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/embeddings");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      model: "nomic-embed-text",
      prompt: "hello",
    });
  });

  it("throws descriptive error on network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const svc = new OllamaEmbeddingService({
      baseUrl: "http://localhost:11434",
      model: "nomic-embed-text",
      dimension: 768,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await expect(svc.embed("x")).rejects.toThrow(/Ollama/);
    await expect(svc.embed("x")).rejects.toThrow(/ECONNREFUSED/);
  });

  it("throws on non-ok HTTP response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("boom", { status: 500 }));
    const svc = new OllamaEmbeddingService({
      baseUrl: "http://localhost:11434",
      model: "nomic-embed-text",
      dimension: 768,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await expect(svc.embed("x")).rejects.toThrow(/500/);
  });
});

describe("TransformersEmbeddingService", () => {
  const fakePipeline = vi.fn().mockResolvedValue({
    data: new Float32Array(1024).fill(0.1),
  });

  beforeEach(() => {
    vi.mocked(pipeline).mockReset();
    fakePipeline.mockClear();
    vi.mocked(pipeline).mockResolvedValue(fakePipeline as any);
  });

  it("loads the pipeline lazily on first embed call", async () => {
    const svc = new TransformersEmbeddingService({
      model: "Alibaba-NLP/gte-large-en-v1.5",
      dimension: 1024,
    });
    expect(pipeline).not.toHaveBeenCalled();
    await svc.embed("test");
    expect(pipeline).toHaveBeenCalledOnce();
  });

  it("reuses the pipeline on subsequent calls (loads only once)", async () => {
    const svc = new TransformersEmbeddingService({
      model: "Alibaba-NLP/gte-large-en-v1.5",
      dimension: 1024,
    });
    await svc.embed("first");
    await svc.embed("second");
    expect(pipeline).toHaveBeenCalledOnce();
  });

  it("returns a number[] of length equal to dimension", async () => {
    const svc = new TransformersEmbeddingService({
      model: "Alibaba-NLP/gte-large-en-v1.5",
      dimension: 1024,
    });
    const result = await svc.embed("blockchain health");
    expect(result).toHaveLength(1024);
    expect(result.every((v) => typeof v === "number")).toBe(true);
  });

  it("calls pipeline with normalize=true and pooling=cls", async () => {
    const svc = new TransformersEmbeddingService({
      model: "Alibaba-NLP/gte-large-en-v1.5",
      dimension: 1024,
    });
    await svc.embed("test");
    expect(fakePipeline).toHaveBeenCalledWith(
      ["test"],
      { normalize: true, pooling: "cls" },
    );
  });

  it("exposes modelName and dimension correctly", () => {
    const svc = new TransformersEmbeddingService({
      model: "Alibaba-NLP/gte-large-en-v1.5",
      dimension: 1024,
    });
    expect(svc.modelName).toBe("Alibaba-NLP/gte-large-en-v1.5");
    expect(svc.dimension).toBe(1024);
  });
});
