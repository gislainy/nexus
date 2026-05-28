import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ChunkingService } from "./chunking.js";
import type { EmbeddingService } from "./embedding.js";

export interface PaperInput {
  title: string;
  authors: string[];
  year: number;
  venue: string;
  doi?: string;
  submodulePath: string;
  pdfHash: string;
  accessType: "open" | "closed";
  layer: "core" | "expanded";
  tags: string[];
  text: string;
}

export interface IndexingResult {
  paperId: string;
  chunksCreated: number;
}

export class IndexingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly chunking: ChunkingService,
    private readonly embedding: EmbeddingService,
  ) {}

  async indexPaper(input: PaperInput): Promise<IndexingResult> {
    const existing = await this.prisma.paper.findFirst({
      where: { pdfHash: input.pdfHash },
      include: { chunks: { select: { id: true } } },
    });
    if (existing) {
      return { paperId: existing.id, chunksCreated: existing.chunks.length };
    }

    const chunks = this.chunking.chunk(input.text);
    const embeddings = await Promise.all(
      chunks.map((c) => this.embedding.embed(c.text)),
    );

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const paper = await tx.paper.create({
        data: {
          title: input.title,
          authors: input.authors,
          year: input.year,
          venue: input.venue,
          doi: input.doi,
          submodulePath: input.submodulePath,
          pdfHash: input.pdfHash,
          accessType: input.accessType,
          layer: input.layer,
        },
      });

      let created = 0;
      for (const [i, chunk] of chunks.entries()) {
        const vector = embeddings[i]!;
        const id = randomUUID();
        const vectorLiteral = `[${vector.join(",")}]`;
        await tx.$executeRaw`
          INSERT INTO knowledge_chunk (id, paper_id, tags, text, embedding, page_ref, layer, access_type, status, created_at)
          VALUES (${id}, ${paper.id}, ${input.tags}::text[], ${chunk.text}, ${vectorLiteral}::public.vector, ${chunk.pageRef ?? null}, ${input.layer}, ${input.accessType}, 'active', NOW())
        `;
        created++;
      }

      return { paperId: paper.id, chunksCreated: created };
    });
  }
}
