import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ChunkingService } from "../../src/services/chunking.js";
import { IndexingService } from "../../src/services/indexing.js";
import type { EmbeddingService } from "../../src/services/embedding.js";

class FakeEmbedding implements EmbeddingService {
  readonly modelName = "fake";
  readonly dimension = 768;
  async embed(_text: string): Promise<number[]> {
    return new Array(this.dimension).fill(0).map((_, i) => (i % 7) / 100);
  }
}

const SAMPLE_TEXT = `
Blockchain has been proposed as a foundational technology for digital health systems,
offering tamper-evident audit trails, decentralized identity management, and cross-organizational
data sharing without a central trusted party. However, the adoption of blockchain in healthcare
faces several intrinsic complexities: regulatory compliance with frameworks like HIPAA and LGPD,
patient privacy guarantees that go beyond pseudonymity, integration with existing electronic health
record systems, and energy or throughput constraints of consensus mechanisms. This work examines
how these dimensions interact and proposes a structured framework for evaluating adoption decisions.
We argue that blockchain is rarely the dominant solution when traditional databases combined with
cryptographic signatures already satisfy the integrity and auditability requirements. A careful
analysis of the trust model, the number of writing parties, and the regulatory context is required
before committing to a distributed ledger architecture in health information systems.
`.trim();

describe("IndexingService (integration)", () => {
  let prisma: PrismaClient;
  const pdfHash = `test-hash-${Date.now()}`;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.knowledgeChunk.deleteMany({
      where: { paper: { pdfHash } },
    });
    await prisma.paper.deleteMany({ where: { pdfHash } });
    await prisma.$disconnect();
  });

  it("indexes a paper and creates chunks with embeddings", async () => {
    const chunking = new ChunkingService({ chunkSize: 128, overlap: 16 });
    const indexing = new IndexingService(prisma, chunking, new FakeEmbedding());

    const result = await indexing.indexPaper({
      title: "Test Paper",
      authors: ["Doe, J."],
      year: 2026,
      venue: "Test Venue",
      submodulePath: "core/test.pdf",
      pdfHash,
      accessType: "open",
      layer: "core",
      tags: ["TECHNICAL_JUSTIFICATION"],
      text: SAMPLE_TEXT,
    });

    expect(result.paperId).toBeTruthy();
    expect(result.chunksCreated).toBeGreaterThan(0);

    const paper = await prisma.paper.findUnique({
      where: { id: result.paperId },
    });
    expect(paper?.title).toBe("Test Paper");
    expect(paper?.authors).toEqual(["Doe, J."]);

    const chunks = await prisma.knowledgeChunk.findMany({
      where: { paperId: result.paperId },
    });
    expect(chunks.length).toBe(result.chunksCreated);
    for (const c of chunks) {
      expect(c.tags).toContain("TECHNICAL_JUSTIFICATION");
      expect(c.layer).toBe("core");
    }

    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "KnowledgeChunk"
      WHERE "paperId" = ${result.paperId} AND embedding IS NOT NULL
    `;
    expect(Number(rows[0].count)).toBe(result.chunksCreated);
  });

  it("is idempotent on the same pdfHash", async () => {
    const chunking = new ChunkingService({ chunkSize: 128, overlap: 16 });
    const indexing = new IndexingService(prisma, chunking, new FakeEmbedding());

    const before = await prisma.paper.count({ where: { pdfHash } });
    const result = await indexing.indexPaper({
      title: "Test Paper",
      authors: ["Doe, J."],
      year: 2026,
      venue: "Test Venue",
      submodulePath: "core/test.pdf",
      pdfHash,
      accessType: "open",
      layer: "core",
      tags: ["TECHNICAL_JUSTIFICATION"],
      text: SAMPLE_TEXT,
    });
    const after = await prisma.paper.count({ where: { pdfHash } });
    expect(after).toBe(before);
    expect(result.chunksCreated).toBeGreaterThan(0);
  });
});
