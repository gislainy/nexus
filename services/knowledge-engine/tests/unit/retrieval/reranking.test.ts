import { describe, it, expect, vi } from "vitest";
import {
  HttpRerankingService,
  RetrievalService,
  type RerankingService,
} from "../../../src/services/retrieval/index.js";
import type { DenseRetrievalService } from "../../../src/services/retrieval/dense.js";
import type { SparseRetrievalService } from "../../../src/services/retrieval/sparse.js";
import type { HybridRetrievalService } from "../../../src/services/retrieval/hybrid.js";

type Chunk = {
  id: string;
  text: string;
  claim: string | null;
  layer: "core" | "expanded";
  pageRef: string | null;
  paper: {
    authors: string[];
    year: number;
    title: string;
    venue: string;
  };
};

function makeChunks(ids: string[]): Chunk[] {
  return ids.map((id) => ({
    id,
    text: `text of ${id}`,
    claim: null,
    layer: "core",
    pageRef: null,
    paper: { authors: ["X"], year: 2024, title: "T", venue: "V" },
  }));
}

function fakePrisma(chunks: Chunk[]) {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  return {
    knowledgeChunk: {
      findMany: vi.fn(async (args: { where: { id: { in: string[] } } }) => {
        return args.where.id.in
          .map((id) => byId.get(id))
          .filter((c): c is Chunk => Boolean(c));
      }),
    },
  } as unknown as ConstructorParameters<typeof RetrievalService>[0];
}

function fakeHybrid(
  candidates: Array<{ chunkId: string; score: number }>,
): HybridRetrievalService {
  return {
    retrieve: vi.fn(async () => candidates),
  } as unknown as HybridRetrievalService;
}

const dummyDense = {} as DenseRetrievalService;
const dummySparse = {} as SparseRetrievalService;

const baseOpts = {
  strategy: "hybrid" as const,
  thresholdByStrategy: { dense: 0, sparse: 0, hybrid: 0 },
};

describe("RetrievalService — reranking integration", () => {
  it("reorders candidates using the reranker", async () => {
    const chunks = makeChunks(["A", "B", "C"]);
    const prisma = fakePrisma(chunks);
    const hybrid = fakeHybrid([
      { chunkId: "A", score: 0.5 },
      { chunkId: "B", score: 0.4 },
      { chunkId: "C", score: 0.3 },
    ]);
    const reranking: RerankingService = {
      rerank: vi.fn(async () => [
        { chunkId: "B", score: 0.9 },
        { chunkId: "A", score: 0.3 },
      ]),
    };
    const svc = new RetrievalService(prisma, dummyDense, dummySparse, hybrid, {
      ...baseOpts,
      reranking,
    });

    const res = await svc.retrieve({ queryText: "q", topK: 5 });
    expect(res.passages.map((p) => p.chunkId)).toEqual(["B", "A"]);
    expect(reranking.rerank).toHaveBeenCalledTimes(1);
  });

  it("falls back to pre-rerank order when reranker throws", async () => {
    const chunks = makeChunks(["A", "B", "C"]);
    const prisma = fakePrisma(chunks);
    const hybrid = fakeHybrid([
      { chunkId: "A", score: 0.5 },
      { chunkId: "B", score: 0.4 },
      { chunkId: "C", score: 0.3 },
    ]);
    const reranking: RerankingService = {
      rerank: vi.fn(async () => {
        throw new TypeError("network down");
      }),
    };
    const svc = new RetrievalService(prisma, dummyDense, dummySparse, hybrid, {
      ...baseOpts,
      reranking,
    });

    const res = await svc.retrieve({ queryText: "q", topK: 5 });
    expect(res.hasEvidence).toBe(true);
    expect(res.passages.map((p) => p.chunkId)).toEqual(["A", "B", "C"]);
  });

  it("does not call the reranker when not configured", async () => {
    const chunks = makeChunks(["A", "B", "C"]);
    const prisma = fakePrisma(chunks);
    const hybrid = fakeHybrid([
      { chunkId: "A", score: 0.5 },
      { chunkId: "B", score: 0.4 },
      { chunkId: "C", score: 0.3 },
    ]);
    const svc = new RetrievalService(
      prisma,
      dummyDense,
      dummySparse,
      hybrid,
      baseOpts,
    );

    const res = await svc.retrieve({ queryText: "q", topK: 5 });
    expect(res.passages.map((p) => p.chunkId)).toEqual(["A", "B", "C"]);
  });

  it("skips reranker when candidates are below minCandidatesForRerank", async () => {
    const chunks = makeChunks(["A", "B"]);
    const prisma = fakePrisma(chunks);
    const hybrid = fakeHybrid([
      { chunkId: "A", score: 0.5 },
      { chunkId: "B", score: 0.4 },
    ]);
    const reranking: RerankingService = {
      rerank: vi.fn(async () => []),
    };
    const svc = new RetrievalService(prisma, dummyDense, dummySparse, hybrid, {
      ...baseOpts,
      reranking,
    });

    const res = await svc.retrieve({ queryText: "q", topK: 5 });
    expect(reranking.rerank).not.toHaveBeenCalled();
    expect(res.passages.map((p) => p.chunkId)).toEqual(["A", "B"]);
  });
});

describe("HttpRerankingService", () => {
  it("POSTs to /rerank and returns parsed list", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          reranked: [
            { chunkId: "B", score: 0.9 },
            { chunkId: "A", score: 0.1 },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    const svc = new HttpRerankingService("http://localhost:8009", fetchImpl);
    const out = await svc.rerank(
      "q",
      [
        { chunkId: "A", text: "a" },
        { chunkId: "B", text: "b" },
      ],
      5,
    );
    expect(out).toEqual([
      { chunkId: "B", score: 0.9 },
      { chunkId: "A", score: 0.1 },
    ]);
  });

  it("throws when the bridge returns non-OK", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("err", { status: 500 }),
    ) as unknown as typeof fetch;
    const svc = new HttpRerankingService("http://localhost:8009", fetchImpl);
    await expect(svc.rerank("q", [{ chunkId: "A", text: "a" }], 1)).rejects.toThrow(
      /500/,
    );
  });
});
