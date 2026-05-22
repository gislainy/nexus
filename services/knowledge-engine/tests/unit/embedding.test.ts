import { describe, it, expect, vi } from "vitest";
import { OllamaEmbeddingService } from "../../src/services/embedding.js";

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
