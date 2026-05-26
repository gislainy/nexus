import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { buildServer } from "../../src/index.js";
import { ChunkingService } from "../../src/services/chunking.js";
import { IndexingService } from "../../src/services/indexing.js";
import type { EmbeddingService } from "../../src/services/embedding.js";
import type {
  GenerationRequest,
  GenerationResponse,
  GenerationService,
} from "../../src/services/generation.js";

const VOCAB = [
  "blockchain",
  "health",
  "records",
  "audit",
  "privacy",
  "ledger",
  "regulatory",
  "compliance",
  "pasta",
  "cooking",
  "consensus",
  "framework",
];

class FakeEmbedding implements EmbeddingService {
  readonly modelName = "fake-keyword";
  readonly dimension = 768;
  async embed(text: string): Promise<number[]> {
    const lower = text.toLowerCase();
    const vec = new Array(this.dimension).fill(0);
    VOCAB.forEach((word, i) => {
      if (lower.includes(word)) vec[i] = 1;
    });
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}

class FakeGenerationService implements GenerationService {
  readonly modelName = "fake-generation";
  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    const first = request.passages[0];
    return {
      answer: first ? `Evidence found: ${first.text.slice(0, 50)}` : "no evidence",
      citedSpans: first
        ? [{ claim: "test", chunkId: first.chunkId, quote: first.text.slice(0, 40) }]
        : [],
      model: "fake-generation",
      latencyMs: 1,
      hasGrounding: request.passages.length > 0,
    };
  }
}

const RELEVANT_TEXT =
  "Blockchain enables tamper-evident audit trails for health records and supports cross-organizational data sharing without a central trusted party. " +
  "It provides cryptographic integrity guarantees on the audit log of every access to patient health records, which is useful in multi-institution settings. " +
  "Blockchain-based health record sharing is often promoted as a way to give patients fine-grained control over which providers can read their health records.";

describe("Answer endpoint (integration)", () => {
  let prisma: PrismaClient;
  let server: Awaited<ReturnType<typeof buildServer>>;
  const pdfHash = `answer-test-hash-${Date.now()}`;

  beforeAll(async () => {
    process.env.RETRIEVAL_STRATEGY = "dense";
    process.env.RELEVANCE_THRESHOLD = "0.3";

    prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.knowledgeChunk.deleteMany({ where: { paper: { pdfHash } } });
    await prisma.paper.deleteMany({ where: { pdfHash } });

    const chunking = new ChunkingService({ chunkSize: 128, overlap: 16 });
    const indexing = new IndexingService(prisma, chunking, new FakeEmbedding());

    await indexing.indexPaper({
      title: "Blockchain Health Paper",
      authors: ["Doe, J."],
      year: 2026,
      venue: "Test Venue",
      submodulePath: "core/a1.pdf",
      pdfHash,
      accessType: "open",
      layer: "core",
      tags: ["TECHNICAL_JUSTIFICATION"],
      text: RELEVANT_TEXT,
    });

    server = await buildServer({
      embedding: new FakeEmbedding(),
      generation: new FakeGenerationService(),
    });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await prisma.knowledgeChunk.deleteMany({ where: { paper: { pdfHash } } });
    await prisma.paper.deleteMany({ where: { pdfHash } });
    await prisma.$disconnect();
  });

  it("returns grounded answer for a relevant query", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/answer",
      payload: { queryText: "blockchain health records audit", topK: 3 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasEvidence).toBe(true);
    expect(typeof body.answer).toBe("string");
    expect(body.answer.length).toBeGreaterThan(0);
    expect(body.citedSpans.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.passages)).toBe(true);
    expect(body.passages[0]).toHaveProperty("chunkId");
    expect(body.passages[0]).toHaveProperty("text");
    expect(body.passages[0]).toHaveProperty("score");
    expect(body.passages[0]).toHaveProperty("source");
  });

  it("returns hasEvidence:false for an irrelevant query", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/answer",
      payload: { queryText: "xyzzy nonsense quux", topK: 3 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasEvidence).toBe(false);
    expect(body.answer).toBeNull();
    expect(body.passages).toEqual([]);
  });

  it("returns 400 when queryText is missing", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/answer",
      payload: { topK: 3 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_request");
  });

  it("returns 400 when topK is negative", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/answer",
      payload: { queryText: "blockchain", topK: -1 },
    });
    expect(res.statusCode).toBe(400);
  });
});
