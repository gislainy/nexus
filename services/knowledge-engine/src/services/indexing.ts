import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
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

    const paper = await this.prisma.paper.create({
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

    const chunks = this.chunking.chunk(input.text);
    let created = 0;
    for (const chunk of chunks) {
      const vector = await this.embedding.embed(chunk.text);
      const id = randomUUID();
      const vectorLiteral = `[${vector.join(",")}]`;
      await this.prisma.$executeRaw`
        INSERT INTO "KnowledgeChunk" (id, "paperId", tags, text, embedding, "pageRef", layer, "accessType", status, "createdAt")
        VALUES (${id}, ${paper.id}, ${input.tags}::text[], ${chunk.text}, ${vectorLiteral}::public.vector, ${chunk.pageRef ?? null}, ${input.layer}, ${input.accessType}, 'active', NOW())
      `;
      created++;
    }

    return { paperId: paper.id, chunksCreated: created };
  }
}
