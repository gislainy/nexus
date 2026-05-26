import type { PrismaClient } from "@prisma/client";
import type { RetrievalService } from "../services/retrieval/index.js";
import { Prisma } from "@prisma/client";
import {
  MetricsCalculator,
  type MetricsResult,
} from "./metrics.js";

export type RetrievalResolver = (
  candidateId: string,
  experimentType: string,
) => Promise<RetrievalService> | RetrievalService;

export interface BenchmarkRunnerOptions {
  topK?: number;
  log?: (msg: string) => void;
}

export class BenchmarkRunner {
  private readonly metrics = new MetricsCalculator();
  private readonly topK: number;
  private readonly log: (msg: string) => void;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly resolveRetrieval: RetrievalResolver,
    options: BenchmarkRunnerOptions = {},
  ) {
    this.topK = options.topK ?? 10;
    this.log = options.log ?? (() => {});
  }

  async run(experimentId: string): Promise<void> {
    const experiment = await this.prisma.iRBenchmarkExperiment.findUnique({
      where: { id: experimentId },
      include: { groundTruth: { include: { pairs: true } } },
    });
    if (!experiment) {
      throw new Error(`experiment_not_found:${experimentId}`);
    }

    await this.prisma.iRBenchmarkExperiment.update({
      where: { id: experimentId },
      data: { status: "RUNNING" },
    });

    const pairs = experiment.groundTruth.pairs;

    for (const candidate of experiment.candidates) {
      this.log(`candidate=${candidate}`);
      const retrieval = await this.resolveRetrieval(
        candidate,
        experiment.experimentType,
      );

      const perQuery: MetricsResult[] = [];
      const byTagBuckets = new Map<string, MetricsResult[]>();
      let totalLatency = 0;

      for (const pair of pairs) {
        const t0 = Date.now();
        const response = await retrieval.retrieve({
          queryText: pair.queryText,
          topK: this.topK,
        });
        totalLatency += Date.now() - t0;

        const result = this.metrics.calculate({
          queryId: pair.id,
          retrievedChunkIds: response.passages.map((p) => p.chunkId),
          relevantChunkIds: pair.relevantChunkIds,
        });
        perQuery.push(result);
        this.log(
          `  query=${pair.id} recall=${result.recallAt10.toFixed(3)} mrr=${result.mrr.toFixed(3)} ndcg=${result.ndcgAt10.toFixed(3)}`,
        );

        if (pair.tag) {
          const bucket = byTagBuckets.get(pair.tag) ?? [];
          bucket.push(result);
          byTagBuckets.set(pair.tag, bucket);
        }
      }

      const aggregated = this.metrics.aggregate(perQuery);
      const byTag: Record<string, MetricsResult> = {};
      for (const [tag, bucket] of byTagBuckets.entries()) {
        byTag[tag] = this.metrics.aggregate(bucket);
      }

      const avgLatency =
        pairs.length > 0 ? Math.round(totalLatency / pairs.length) : 0;

      await this.prisma.iRBenchmarkResult.create({
        data: {
          experimentId,
          candidateId: candidate,
          recallAt10: aggregated.recallAt10,
          mrr: aggregated.mrr,
          ndcgAt10: aggregated.ndcgAt10,
          queryLatencyMs: avgLatency,
          byTag: byTag as unknown as Prisma.InputJsonValue,
        },
      });
    }

    await this.prisma.iRBenchmarkExperiment.update({
      where: { id: experimentId },
      data: { status: "EVALUATING" },
    });
  }
}
