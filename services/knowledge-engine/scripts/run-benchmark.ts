#!/usr/bin/env node
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { DenseRetrievalService } from "../src/services/retrieval/dense.js";
import { SparseRetrievalService } from "../src/services/retrieval/sparse.js";
import { HybridRetrievalService } from "../src/services/retrieval/hybrid.js";
import {
  RetrievalService,
  type RetrievalStrategy,
} from "../src/services/retrieval/index.js";
import { OllamaEmbeddingService } from "../src/services/embedding.js";
import { BenchmarkRunner } from "../src/benchmark/runner.js";

const VALID_STRATEGIES: RetrievalStrategy[] = ["dense", "sparse", "hybrid"];

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { "experiment-id": { type: "string" } },
    allowPositionals: false,
  });
  if (!values["experiment-id"]) {
    console.error("usage: run-benchmark --experiment-id <uuid>");
    return 2;
  }
  const experimentId = values["experiment-id"];

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();

    const rrfK = Number(process.env.RRF_K ?? "60");
    const minCosine = Number(process.env.DENSE_MIN_COSINE ?? "0.5");

    const buildRetrievalForCandidate = async (
      candidateId: string,
      experimentType: string,
    ): Promise<RetrievalService> => {
      let modelName = process.env.EMBEDDING_MODEL ?? "nomic-embed-text";
      let strategy: RetrievalStrategy = "hybrid";

      if (experimentType === "embedding_model") {
        modelName = candidateId;
      } else if (experimentType === "retrieval_strategy") {
        if (!VALID_STRATEGIES.includes(candidateId as RetrievalStrategy)) {
          throw new Error(`invalid_strategy:${candidateId}`);
        }
        strategy = candidateId as RetrievalStrategy;
      } else if (experimentType === "combined") {
        const [m, s] = candidateId.split(":");
        if (!m || !s || !VALID_STRATEGIES.includes(s as RetrievalStrategy)) {
          throw new Error(`invalid_combined_candidate:${candidateId}`);
        }
        modelName = m;
        strategy = s as RetrievalStrategy;
      } else {
        throw new Error(`unknown_experiment_type:${experimentType}`);
      }

      const embedding = new OllamaEmbeddingService({
        baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        model: modelName,
        dimension: Number(process.env.EMBEDDING_DIM ?? "768"),
      });
      const dense = new DenseRetrievalService(prisma, embedding, { minCosine });
      const sparse = new SparseRetrievalService(prisma);
      await sparse.buildIndex();
      const hybrid = new HybridRetrievalService(dense, sparse, { rrfK });

      return new RetrievalService(prisma, dense, sparse, hybrid, {
        strategy,
        thresholdByStrategy: { dense: minCosine, sparse: 0, hybrid: 0 },
      });
    };

    const runner = new BenchmarkRunner(prisma, buildRetrievalForCandidate, {
      log: (msg) => console.log(msg),
    });

    console.log(`running experiment ${experimentId}`);
    await runner.run(experimentId);

    const results = await prisma.iRBenchmarkResult.findMany({
      where: { experimentId },
    });
    console.log("\nsummary:");
    for (const r of results) {
      console.log(
        `  ${r.candidateId}: recall@10=${r.recallAt10.toFixed(3)} mrr=${r.mrr.toFixed(3)} ndcg@10=${r.ndcgAt10.toFixed(3)}`,
      );
    }
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
