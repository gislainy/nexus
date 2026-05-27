import { describe, it, expect } from "vitest";
import {
  OllamaGenerationService,
  type GenerationRequest,
} from "../../src/services/generation.js";

function makeRequest(): GenerationRequest {
  return {
    queryText: "What does blockchain provide?",
    passages: [
      {
        chunkId: "abc",
        text: "Blockchain provides tamper-evident audit trails for health records.",
        source: {
          authors: ["Doe, J."],
          year: 2026,
          title: "Sample",
          venue: "Venue",
        },
      },
    ],
  };
}

function fakeFetch(
  handler: (input: unknown, init?: unknown) => Response | Promise<Response>,
): typeof fetch {
  return ((input: unknown, init?: unknown) =>
    Promise.resolve(handler(input, init))) as unknown as typeof fetch;
}

describe("OllamaGenerationService", () => {
  it("parses valid ERG JSON response", async () => {
    const fetchImpl = fakeFetch(() => {
      const body = JSON.stringify({
        message: {
          content: JSON.stringify({
            answer: "Blockchain provides auditability.",
            cited_spans: [
              {
                claim: "auditability",
                chunk_id: "abc",
                quote: "tamper-evident audit trails",
              },
            ],
          }),
        },
      });
      return new Response(body, { status: 200 });
    });

    const svc = new OllamaGenerationService({
      baseUrl: "http://fake",
      model: "test",
      maxTokens: 256,
      fetchImpl,
    });
    const res = await svc.generate(makeRequest());
    expect(res.answer).toBe("Blockchain provides auditability.");
    expect(res.citedSpans).toHaveLength(1);
    expect(res.citedSpans[0]!.chunkId).toBe("abc");
    expect(res.hasGrounding).toBe(true);
    expect(res.model).toBe("test");
  });

  it("falls back to raw text when content is not JSON", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(
        JSON.stringify({ message: { content: "I cannot answer this." } }),
        { status: 200 },
      ),
    );
    const svc = new OllamaGenerationService({
      baseUrl: "http://fake",
      model: "test",
      maxTokens: 256,
      fetchImpl,
    });
    const res = await svc.generate(makeRequest());
    expect(res.answer).toBe("I cannot answer this.");
    expect(res.citedSpans).toEqual([]);
    expect(res.hasGrounding).toBe(false);
  });

  it("throws unavailable error on network failure", async () => {
    const fetchImpl = (() => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const svc = new OllamaGenerationService({
      baseUrl: "http://fake",
      model: "test",
      maxTokens: 256,
      fetchImpl,
    });
    await expect(svc.generate(makeRequest())).rejects.toThrow(
      /Ollama generation unavailable/,
    );
  });

  it("throws on HTTP 503 from Ollama", async () => {
    const fetchImpl = fakeFetch(() => new Response("", { status: 503 }));
    const svc = new OllamaGenerationService({
      baseUrl: "http://fake",
      model: "test",
      maxTokens: 256,
      fetchImpl,
    });
    await expect(svc.generate(makeRequest())).rejects.toThrow(/503/);
  });

  it("hasGrounding=false when cited_spans is empty", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({ answer: "No evidence.", cited_spans: [] }),
          },
        }),
        { status: 200 },
      ),
    );
    const svc = new OllamaGenerationService({
      baseUrl: "http://fake",
      model: "test",
      maxTokens: 256,
      fetchImpl,
    });
    const res = await svc.generate(makeRequest());
    expect(res.hasGrounding).toBe(false);
    expect(res.answer).toBe("No evidence.");
  });

  it("num_ctx is passed in the Ollama payload (default 8192)", async () => {
    let captured: { options?: { num_ctx?: number } } | undefined;
    const fetchImpl = fakeFetch((_input, init) => {
      const body = (init as { body?: string } | undefined)?.body ?? "{}";
      captured = JSON.parse(body) as { options?: { num_ctx?: number } };
      return new Response(
        JSON.stringify({
          message: { content: JSON.stringify({ answer: "x", cited_spans: [] }) },
        }),
        { status: 200 },
      );
    });
    const svc = new OllamaGenerationService({
      baseUrl: "http://fake",
      model: "test",
      maxTokens: 256,
      fetchImpl,
    });
    await svc.generate(makeRequest());
    expect(captured?.options?.num_ctx).toBe(8192);
  });

  it("custom numCtx overrides default", async () => {
    let captured: { options?: { num_ctx?: number } } | undefined;
    const fetchImpl = fakeFetch((_input, init) => {
      const body = (init as { body?: string } | undefined)?.body ?? "{}";
      captured = JSON.parse(body) as { options?: { num_ctx?: number } };
      return new Response(
        JSON.stringify({
          message: { content: JSON.stringify({ answer: "x", cited_spans: [] }) },
        }),
        { status: 200 },
      );
    });
    const svc = new OllamaGenerationService({
      baseUrl: "http://fake",
      model: "test",
      maxTokens: 256,
      numCtx: 4096,
      fetchImpl,
    });
    await svc.generate(makeRequest());
    expect(captured?.options?.num_ctx).toBe(4096);
  });

  it("user prompt contains query at start and end", async () => {
    let userContent = "";
    const fetchImpl = fakeFetch((_input, init) => {
      const body = (init as { body?: string } | undefined)?.body ?? "{}";
      const parsed = JSON.parse(body) as {
        messages: { role: string; content: string }[];
      };
      userContent =
        parsed.messages.find((m) => m.role === "user")?.content ?? "";
      return new Response(
        JSON.stringify({
          message: { content: JSON.stringify({ answer: "x", cited_spans: [] }) },
        }),
        { status: 200 },
      );
    });
    const svc = new OllamaGenerationService({
      baseUrl: "http://fake",
      model: "test",
      maxTokens: 256,
      fetchImpl,
    });
    const req = makeRequest();
    await svc.generate(req);
    expect(userContent).toContain(`QUERY: ${req.queryText}`);
    expect(userContent).toContain(`QUERY (restated): ${req.queryText}`);
  });

  it("latencyMs is a non-negative number", async () => {
    const fetchImpl = fakeFetch(() =>
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({ answer: "ok", cited_spans: [] }),
          },
        }),
        { status: 200 },
      ),
    );
    const svc = new OllamaGenerationService({
      baseUrl: "http://fake",
      model: "test",
      maxTokens: 256,
      fetchImpl,
    });
    const res = await svc.generate(makeRequest());
    expect(typeof res.latencyMs).toBe("number");
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
