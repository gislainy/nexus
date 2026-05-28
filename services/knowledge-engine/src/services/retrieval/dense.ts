import type { PrismaClient } from "@prisma/client";
import type { EmbeddingService } from "../embedding.js";

export interface RetrievalCandidate {
  chunkId: string;
  score: number;
}

export interface DenseRetrievalOptions {
  minCosine: number;
}

export class DenseRetrievalService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly embedding: EmbeddingService,
    private readonly options: DenseRetrievalOptions = { minCosine: 0 },
  ) {}

  async retrieve(
    queryText: string,
    topK: number,
    tag?: string,
  ): Promise<RetrievalCandidate[]> {
    const vector = await this.embedding.embed(queryText);
    const literal = `[${vector.join(",")}]`;
    const minCosine = this.options.minCosine;
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; score: number }>
    >`
      SELECT id, 1 - (embedding OPERATOR(public.<=>) ${literal}::public.vector) AS score
      FROM knowledge_chunk
      WHERE status = 'active'
        AND (${tag ?? null}::text IS NULL OR ${tag ?? null}::text = ANY(tags))
        AND 1 - (embedding OPERATOR(public.<=>) ${literal}::public.vector) >= ${minCosine}
      ORDER BY embedding OPERATOR(public.<=>) ${literal}::public.vector
      LIMIT ${topK}
    `;
    return rows.map((r) => ({ chunkId: r.id, score: Number(r.score) }));
  }
}
