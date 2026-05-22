export interface MetricsInput {
  queryId: string;
  retrievedChunkIds: string[];
  relevantChunkIds: string[];
}

export interface MetricsResult {
  recallAt10: number;
  mrr: number;
  ndcgAt10: number;
}

const K = 10;

export class MetricsCalculator {
  calculate(input: MetricsInput): MetricsResult {
    const relevant = new Set(input.relevantChunkIds);
    const topK = input.retrievedChunkIds.slice(0, K);

    const recallAt10 =
      relevant.size === 0
        ? 0
        : topK.filter((id) => relevant.has(id)).length / relevant.size;

    let mrr = 0;
    for (let i = 0; i < topK.length; i++) {
      if (relevant.has(topK[i]!)) {
        mrr = 1 / (i + 1);
        break;
      }
    }

    let dcg = 0;
    for (let i = 0; i < topK.length; i++) {
      const rel = relevant.has(topK[i]!) ? 1 : 0;
      dcg += rel / Math.log2(i + 2);
    }
    const idealHits = Math.min(relevant.size, K);
    let idcg = 0;
    for (let i = 0; i < idealHits; i++) {
      idcg += 1 / Math.log2(i + 2);
    }
    const ndcgAt10 = idcg === 0 ? 0 : dcg / idcg;

    return { recallAt10, mrr, ndcgAt10 };
  }

  aggregate(results: MetricsResult[]): MetricsResult {
    if (results.length === 0) {
      return { recallAt10: 0, mrr: 0, ndcgAt10: 0 };
    }
    const n = results.length;
    const sum = results.reduce(
      (acc, r) => ({
        recallAt10: acc.recallAt10 + r.recallAt10,
        mrr: acc.mrr + r.mrr,
        ndcgAt10: acc.ndcgAt10 + r.ndcgAt10,
      }),
      { recallAt10: 0, mrr: 0, ndcgAt10: 0 },
    );
    return {
      recallAt10: sum.recallAt10 / n,
      mrr: sum.mrr / n,
      ndcgAt10: sum.ndcgAt10 / n,
    };
  }
}
