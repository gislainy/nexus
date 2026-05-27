import type { PrismaClient } from "@prisma/client";
import type { DenseRetrievalService, RetrievalCandidate } from "./dense.js";
import type { SparseRetrievalService } from "./sparse.js";
import type { HybridRetrievalService } from "./hybrid.js";

export type RetrievalStrategy = "dense" | "sparse" | "hybrid";

export interface RetrievalRequestInput {
  queryText: string;
  topK: number;
  tag?: string;
}

interface RetrievedPassageSource {
  authors: string[];
  year: number;
  title: string;
  venue: string;
  pageRef?: string;
}

export interface RetrievedPassageOut {
  chunkId: string;
  text: string;
  claim?: string;
  score: number;
  layer: "core" | "expanded";
  source: RetrievedPassageSource;
}

export interface RetrievalResponseOut {
  hasEvidence: boolean;
  passages: RetrievedPassageOut[];
}

export interface RerankCandidate {
  chunkId: string;
  text: string;
}

export interface RerankingService {
  rerank(
    query: string,
    candidates: RerankCandidate[],
    topK: number,
  ): Promise<Array<{ chunkId: string; score: number }>>;
}

export class HttpRerankingService implements RerankingService {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async rerank(
    query: string,
    candidates: RerankCandidate[],
    topK: number,
  ): Promise<Array<{ chunkId: string; score: number }>> {
    const res = await this.fetchImpl(`${this.baseUrl}/rerank`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, candidates, topK }),
    });
    if (!res.ok) {
      throw new Error(`Reranker returned ${res.status}`);
    }
    const data = (await res.json()) as {
      reranked: Array<{ chunkId: string; score: number }>;
    };
    return data.reranked;
  }
}

export interface RetrievalServiceOptions {
  strategy: RetrievalStrategy;
  thresholdByStrategy: Record<RetrievalStrategy, number>;
  reranking?: RerankingService;
  rerankTopK?: number;
  minCandidatesForRerank?: number;
}

export class RetrievalService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly dense: DenseRetrievalService,
    private readonly sparse: SparseRetrievalService,
    private readonly hybrid: HybridRetrievalService,
    private readonly options: RetrievalServiceOptions,
  ) {}

  async retrieve(request: RetrievalRequestInput): Promise<RetrievalResponseOut> {
    const candidates = await this.runStrategy(request);
    const threshold = this.options.thresholdByStrategy[this.options.strategy];
    let filtered: Array<{ chunkId: string; score: number }> = candidates.filter(
      (c) => c.score >= threshold,
    );

    const minForRerank = this.options.minCandidatesForRerank ?? 3;
    if (this.options.reranking && filtered.length >= minForRerank) {
      const texts = await this.fetchTextsForReranking(filtered);
      const rerankCandidates: RerankCandidate[] = filtered.map((c) => ({
        chunkId: c.chunkId,
        text: texts.get(c.chunkId) ?? "",
      }));
      const rerankTopK = this.options.rerankTopK ?? request.topK;
      try {
        const reranked = await this.options.reranking.rerank(
          request.queryText,
          rerankCandidates,
          rerankTopK,
        );
        filtered = reranked;
      } catch {
        // reranker unavailable — fallback to pre-rerank order
      }
    }

    if (filtered.length === 0) {
      return { hasEvidence: false, passages: [] };
    }
    const passages = await this.hydrate(filtered);
    return { hasEvidence: passages.length > 0, passages };
  }

  private async fetchTextsForReranking(
    candidates: Array<{ chunkId: string }>,
  ): Promise<Map<string, string>> {
    const ids = candidates.map((c) => c.chunkId);
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { id: { in: ids } },
      select: { id: true, text: true },
    });
    return new Map(chunks.map((c) => [c.id, c.text]));
  }

  private async runStrategy(
    request: RetrievalRequestInput,
  ): Promise<RetrievalCandidate[]> {
    const { queryText, topK, tag } = request;
    switch (this.options.strategy) {
      case "dense":
        return this.dense.retrieve(queryText, topK, tag);
      case "sparse":
        return this.sparse.retrieve(queryText, topK, tag);
      case "hybrid":
      default:
        return this.hybrid.retrieve(queryText, topK, tag);
    }
  }

  private async hydrate(
    candidates: RetrievalCandidate[],
  ): Promise<RetrievedPassageOut[]> {
    const ids = candidates.map((c) => c.chunkId);
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { id: { in: ids } },
      include: { paper: true },
    });
    const byId = new Map(chunks.map((c) => [c.id, c]));
    const out: RetrievedPassageOut[] = [];
    for (const cand of candidates) {
      const c = byId.get(cand.chunkId);
      if (!c) continue;
      out.push({
        chunkId: c.id,
        text: c.text,
        claim: c.claim ?? undefined,
        score: cand.score,
        layer: (c.layer as "core" | "expanded"),
        source: {
          authors: c.paper.authors,
          year: c.paper.year,
          title: c.paper.title,
          venue: c.paper.venue,
          pageRef: c.pageRef ?? undefined,
        },
      });
    }
    return out;
  }
}
