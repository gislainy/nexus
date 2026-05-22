import type { DenseRetrievalService } from "./dense.js";
import type { SparseRetrievalService } from "./sparse.js";
import type { RetrievalCandidate } from "./dense.js";

export interface HybridOptions {
  rrfK: number;
}

export class HybridRetrievalService {
  constructor(
    private readonly dense: DenseRetrievalService,
    private readonly sparse: SparseRetrievalService,
    private readonly options: HybridOptions,
  ) {}

  async retrieve(
    queryText: string,
    topK: number,
    tag?: string,
  ): Promise<RetrievalCandidate[]> {
    const [denseHits, sparseHits] = await Promise.all([
      this.dense.retrieve(queryText, topK, tag),
      Promise.resolve(this.sparse.retrieve(queryText, topK, tag)),
    ]);
    return HybridRetrievalService.fuse(
      denseHits,
      sparseHits,
      topK,
      this.options.rrfK,
    );
  }

  /** Pure RRF fusion — exposed for unit testing. */
  static fuse(
    dense: RetrievalCandidate[],
    sparse: RetrievalCandidate[],
    topK: number,
    rrfK: number,
  ): RetrievalCandidate[] {
    const missingRank = topK + 1;
    const denseRank = new Map<string, number>();
    dense.forEach((c, i) => denseRank.set(c.chunkId, i + 1));
    const sparseRank = new Map<string, number>();
    sparse.forEach((c, i) => sparseRank.set(c.chunkId, i + 1));

    const ids = new Set<string>([...denseRank.keys(), ...sparseRank.keys()]);
    const fused: RetrievalCandidate[] = [];
    for (const id of ids) {
      const rd = denseRank.get(id) ?? missingRank;
      const rs = sparseRank.get(id) ?? missingRank;
      const contribDense = denseRank.has(id) ? 1 / (rrfK + rd) : 0;
      const contribSparse = sparseRank.has(id) ? 1 / (rrfK + rs) : 0;
      fused.push({ chunkId: id, score: contribDense + contribSparse });
    }
    fused.sort((a, b) => b.score - a.score);
    return fused.slice(0, topK);
  }
}
