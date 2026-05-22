import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { buildServer } from "../../src/index.js";
import { ChunkingService } from "../../src/services/chunking.js";
import { IndexingService } from "../../src/services/indexing.js";
import type { EmbeddingService } from "../../src/services/embedding.js";

/**
 * Deterministic, query-aware fake embedding: encodes presence of a small
 * keyword vocabulary so cosine similarity is non-trivial across our seeded
 * chunks while not depending on any external service.
 */
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
    // Normalize (so cosine similarity is bounded properly)
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}

// Texts must exceed MIN_CHUNK_TOKENS (50) so chunking emits at least one chunk.
const RELEVANT_TEXT =
  "Blockchain enables tamper-evident audit trails for health records and supports cross-organizational data sharing without a central trusted party. " +
  "It provides cryptographic integrity guarantees on the audit log of every access to patient health records, which is useful in multi-institution settings. " +
  "Blockchain-based health record sharing is often promoted as a way to give patients fine-grained control over which providers can read their health records.";
const TAGGED_TEXT =
  "Regulatory compliance frameworks such as HIPAA and LGPD govern blockchain adoption in health information systems and impose strict requirements. " +
  "Any regulatory compliance evaluation of blockchain in healthcare must account for retention rules, the right to erasure, and lawful processing bases. " +
  "Regulatory compliance is therefore a central dimension when deciding whether a distributed ledger fits a given health information system.";
const COOKING_TEXT =
  "Pasta carbonara is a classic Italian dish made with eggs, cheese, and pancetta. Authentic pasta carbonara never uses cream; the silky texture comes from emulsifying egg yolks with starchy pasta water. " +
  "Cooking pasta carbonara well requires timing: drain the pasta while still al dente and toss it off the heat with the egg-and-cheese mixture. " +
  "Cooking variations include using guanciale instead of pancetta and adding freshly cracked black pepper just before serving.";

describe("Retrieve endpoint (integration)", () => {
  let prisma: PrismaClient;
  let server: Awaited<ReturnType<typeof buildServer>>;
  const pdfHash = `retrieve-test-hash-${Date.now()}`;
  let chunkIdRelevant = "";

  beforeAll(async () => {
    // Force dense strategy so the fake keyword embedding drives ranking.
    process.env.RETRIEVAL_STRATEGY = "dense";
    process.env.RELEVANCE_THRESHOLD = "0.3";

    prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.knowledgeChunk.deleteMany({ where: { paper: { pdfHash } } });
    await prisma.paper.deleteMany({ where: { pdfHash } });

    const chunking = new ChunkingService({ chunkSize: 128, overlap: 16 });
    const indexing = new IndexingService(prisma, chunking, new FakeEmbedding());

    const r1 = await indexing.indexPaper({
      title: "Blockchain Health Paper",
      authors: ["Doe, J."],
      year: 2026,
      venue: "Test Venue",
      submodulePath: "core/r1.pdf",
      pdfHash,
      accessType: "open",
      layer: "core",
      tags: ["TECHNICAL_JUSTIFICATION"],
      text: RELEVANT_TEXT,
    });
    const chunks1 = await prisma.knowledgeChunk.findMany({
      where: { paperId: r1.paperId },
    });
    chunkIdRelevant = chunks1[0]!.id;

    await indexing.indexPaper({
      title: "Regulatory Paper",
      authors: ["Roe, R."],
      year: 2026,
      venue: "Test Venue",
      submodulePath: "core/r2.pdf",
      pdfHash: `${pdfHash}-2`,
      accessType: "open",
      layer: "core",
      tags: ["REGULATORY_COMPLIANCE"],
      text: TAGGED_TEXT,
    });
    await indexing.indexPaper({
      title: "Cooking Paper",
      authors: ["Smith, A."],
      year: 2026,
      venue: "Test Venue",
      submodulePath: "core/r3.pdf",
      pdfHash: `${pdfHash}-3`,
      accessType: "open",
      layer: "core",
      tags: ["COOKING"],
      text: COOKING_TEXT,
    });

    server = await buildServer({ embedding: new FakeEmbedding() });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    for (const h of [pdfHash, `${pdfHash}-2`, `${pdfHash}-3`]) {
      await prisma.knowledgeChunk.deleteMany({ where: { paper: { pdfHash: h } } });
      await prisma.paper.deleteMany({ where: { pdfHash: h } });
    }
    await prisma.$disconnect();
  });

  it("returns passages for a relevant query", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/retrieve",
      payload: { queryText: "blockchain health records audit", topK: 3 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasEvidence).toBe(true);
    expect(body.passages.length).toBeGreaterThan(0);
  });

  it("returns hasEvidence:false for an unrelated query", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/retrieve",
      payload: { queryText: "xyzzy nonsense quux", topK: 3 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasEvidence).toBe(false);
    expect(body.passages).toEqual([]);
  });

  it("filters by tag", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/retrieve",
      payload: {
        queryText: "blockchain health",
        topK: 5,
        tag: "REGULATORY_COMPLIANCE",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    if (body.hasEvidence) {
      for (const p of body.passages) {
        expect(p.source.title).toBe("Regulatory Paper");
      }
    }
  });

  it("GET /chunks/:id returns existing chunk with paper metadata", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/chunks/${chunkIdRelevant}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.chunkId).toBe(chunkIdRelevant);
    expect(body.source.title).toBe("Blockchain Health Paper");
    expect(body).not.toHaveProperty("score");
  });

  it("GET /chunks/:id returns 404 for missing chunk", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/chunks/00000000-0000-0000-0000-000000000000",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "chunk_not_found" });
  });
});
