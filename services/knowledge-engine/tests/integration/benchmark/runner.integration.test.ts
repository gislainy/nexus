import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ChunkingService } from "../../../src/services/chunking.js";
import { IndexingService } from "../../../src/services/indexing.js";
import { DenseRetrievalService } from "../../../src/services/retrieval/dense.js";
import { SparseRetrievalService } from "../../../src/services/retrieval/sparse.js";
import { HybridRetrievalService } from "../../../src/services/retrieval/hybrid.js";
import { RetrievalService } from "../../../src/services/retrieval/index.js";
import { BenchmarkRunner } from "../../../src/benchmark/runner.js";
import type { EmbeddingService } from "../../../src/services/embedding.js";

const VOCAB = [
  "blockchain",
  "health",
  "records",
  "audit",
  "privacy",
  "regulatory",
  "compliance",
  "consensus",
];

class FakeEmbedding implements EmbeddingService {
  readonly modelName = "fake-keyword";
  readonly dimension = 768;
  async embed(text: string): Promise<number[]> {
    const lower = text.toLowerCase();
    const vec = new Array(this.dimension).fill(0);
    VOCAB.forEach((w, i) => {
      if (lower.includes(w)) vec[i] = 1;
    });
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}

const TEXT_A =
  "Blockchain enables tamper-evident audit trails for health records and supports cross-organizational data sharing without a central trusted party. " +
  "It provides cryptographic integrity guarantees on the audit log of every access to patient health records, which is useful in multi-institution settings. " +
  "Blockchain-based health record sharing is often promoted as a way to give patients fine-grained control over which providers can read their health records.";
const TEXT_B =
  "Regulatory compliance frameworks such as HIPAA and LGPD govern blockchain adoption in health information systems and impose strict requirements. " +
  "Any regulatory compliance evaluation of blockchain in healthcare must account for retention rules, the right to erasure, and lawful processing bases. " +
  "Regulatory compliance is therefore a central dimension when deciding whether a distributed ledger fits a given health information system.";

describe("BenchmarkRunner (integration)", () => {
  let prisma: PrismaClient;
  const pdfHashA = `bench-test-A-${Date.now()}`;
  const pdfHashB = `bench-test-B-${Date.now()}`;
  let chunkA = "";
  let chunkB = "";
  let groundTruthId = "";
  let experimentId = "";

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const chunking = new ChunkingService({ chunkSize: 128, overlap: 16 });
    const embedding = new FakeEmbedding();
    const indexing = new IndexingService(prisma, chunking, embedding);

    const a = await indexing.indexPaper({
      title: "Audit Paper",
      authors: ["A."],
      year: 2026,
      venue: "T",
      submodulePath: "core/a.pdf",
      pdfHash: pdfHashA,
      accessType: "open",
      layer: "core",
      tags: ["TECHNICAL_JUSTIFICATION"],
      text: TEXT_A,
    });
    const b = await indexing.indexPaper({
      title: "Regulatory Paper",
      authors: ["B."],
      year: 2026,
      venue: "T",
      submodulePath: "core/b.pdf",
      pdfHash: pdfHashB,
      accessType: "open",
      layer: "core",
      tags: ["REGULATORY_COMPLIANCE"],
      text: TEXT_B,
    });

    chunkA = (await prisma.knowledgeChunk.findMany({ where: { paperId: a.paperId } }))[0]!.id;
    chunkB = (await prisma.knowledgeChunk.findMany({ where: { paperId: b.paperId } }))[0]!.id;

    const gt = await prisma.iRGroundTruth.create({
      data: {
        version: `gt-${Date.now()}`,
        description: "test",
        pairs: {
          create: [
            {
              queryText: "blockchain audit health records",
              tag: "TECHNICAL_JUSTIFICATION",
              relevantChunkIds: [chunkA],
            },
            {
              queryText: "regulatory compliance health",
              tag: "REGULATORY_COMPLIANCE",
              relevantChunkIds: [chunkB],
            },
          ],
        },
      },
    });
    groundTruthId = gt.id;

    const exp = await prisma.iRBenchmarkExperiment.create({
      data: {
        name: "test-exp",
        description: "runner integration",
        experimentType: "retrieval_strategy",
        candidates: ["dense"],
        groundTruthId,
        status: "PLANNED",
      },
    });
    experimentId = exp.id;

    const dense = new DenseRetrievalService(prisma, embedding, { minCosine: 0.3 });
    const sparse = new SparseRetrievalService(prisma);
    const hybrid = new HybridRetrievalService(dense, sparse, { rrfK: 60 });

    const buildRetrieval = (strategy: "dense" | "sparse" | "hybrid") =>
      new RetrievalService(prisma, dense, sparse, hybrid, {
        strategy,
        thresholdByStrategy: { dense: 0.3, sparse: 0, hybrid: 0 },
      });

    const runner = new BenchmarkRunner(
      prisma,
      (candidate) => buildRetrieval(candidate as "dense" | "sparse" | "hybrid"),
    );
    await runner.run(experimentId);
  });

  afterAll(async () => {
    await prisma.iRBenchmarkResult.deleteMany({ where: { experimentId } });
    await prisma.iRBenchmarkExperiment.deleteMany({ where: { id: experimentId } });
    await prisma.iRGroundTruthPair.deleteMany({ where: { groundTruthId } });
    await prisma.iRGroundTruth.deleteMany({ where: { id: groundTruthId } });
    for (const h of [pdfHashA, pdfHashB]) {
      await prisma.knowledgeChunk.deleteMany({ where: { paper: { pdfHash: h } } });
      await prisma.paper.deleteMany({ where: { pdfHash: h } });
    }
    await prisma.$disconnect();
  });

  it("persists IRBenchmarkResult with non-null metrics", async () => {
    const results = await prisma.iRBenchmarkResult.findMany({ where: { experimentId } });
    expect(results.length).toBe(1);
    const r = results[0]!;
    expect(r.candidateId).toBe("dense");
    expect(r.recallAt10).toBeGreaterThan(0);
    expect(r.mrr).toBeGreaterThan(0);
    expect(r.ndcgAt10).toBeGreaterThan(0);
    expect(r.byTag).toBeTruthy();
  });

  it("updates experiment status to EVALUATING", async () => {
    const exp = await prisma.iRBenchmarkExperiment.findUnique({ where: { id: experimentId } });
    expect(exp?.status).toBe("EVALUATING");
  });
});
