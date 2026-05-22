import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { DenseRetrievalService } from "../services/retrieval/dense.js";
import { SparseRetrievalService } from "../services/retrieval/sparse.js";
import { HybridRetrievalService } from "../services/retrieval/hybrid.js";
import {
  RetrievalService,
  type RetrievalStrategy,
} from "../services/retrieval/index.js";
import {
  OllamaEmbeddingService,
  type EmbeddingService,
} from "../services/embedding.js";

declare module "fastify" {
  interface FastifyInstance {
    retrieval: RetrievalService;
    sparseRetrieval: SparseRetrievalService;
  }
}

export interface RetrievalPluginOptions {
  embedding?: EmbeddingService;
}

const retrievalPlugin: FastifyPluginAsync<RetrievalPluginOptions> = async (
  fastify,
  opts,
) => {
  const strategy = (process.env.RETRIEVAL_STRATEGY ?? "hybrid") as RetrievalStrategy;
  const rrfK = Number(process.env.RRF_K ?? "60");
  const minCosine = Number(process.env.DENSE_MIN_COSINE ?? "0.5");
  const defaultThresholdByStrategy: Record<RetrievalStrategy, number> = {
    dense: minCosine,
    sparse: 0,
    hybrid: 0,
  };
  const relevanceThreshold = process.env.RELEVANCE_THRESHOLD
    ? Number(process.env.RELEVANCE_THRESHOLD)
    : defaultThresholdByStrategy[strategy];

  const embedding: EmbeddingService =
    opts.embedding ??
    new OllamaEmbeddingService({
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      model: process.env.EMBEDDING_MODEL ?? "nomic-embed-text",
      dimension: Number(process.env.EMBEDDING_DIM ?? "768"),
    });

  const dense = new DenseRetrievalService(fastify.prisma, embedding, { minCosine });
  const sparse = new SparseRetrievalService(fastify.prisma);
  const hybrid = new HybridRetrievalService(dense, sparse, { rrfK });
  const retrieval = new RetrievalService(fastify.prisma, dense, sparse, hybrid, {
    strategy,
    relevanceThreshold,
  });

  fastify.decorate("retrieval", retrieval);
  fastify.decorate("sparseRetrieval", sparse);

  fastify.addHook("onReady", async () => {
    try {
      await sparse.buildIndex();
      fastify.log.info("BM25 sparse index built");
    } catch (err) {
      fastify.log.error({ err }, "failed to build BM25 sparse index");
    }
  });
};

export default fp(retrievalPlugin, {
  name: "retrieval",
  dependencies: ["prisma"],
});
