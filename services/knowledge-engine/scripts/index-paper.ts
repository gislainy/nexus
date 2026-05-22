#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { ChunkingService } from "../src/services/chunking.js";
import {
  OllamaEmbeddingService,
  type EmbeddingService,
} from "../src/services/embedding.js";
import { IndexingService } from "../src/services/indexing.js";

class DryRunEmbedding implements EmbeddingService {
  readonly modelName = "dry-run";
  readonly dimension: number;
  constructor(dim: number) {
    this.dimension = dim;
  }
  async embed(_text: string): Promise<number[]> {
    return new Array(this.dimension).fill(0);
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      title: { type: "string" },
      authors: { type: "string", multiple: true },
      year: { type: "string" },
      venue: { type: "string" },
      doi: { type: "string" },
      "submodule-path": { type: "string" },
      "pdf-hash": { type: "string" },
      "access-type": { type: "string" },
      layer: { type: "string" },
      tags: { type: "string", multiple: true },
      "text-file": { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const required = [
    "title",
    "year",
    "venue",
    "submodule-path",
    "pdf-hash",
    "access-type",
    "layer",
    "text-file",
  ] as const;
  for (const k of required) {
    if (!values[k]) {
      console.error(`Missing required --${k}`);
      return 1;
    }
  }

  const accessType = values["access-type"] as string;
  if (accessType !== "open" && accessType !== "closed") {
    console.error("--access-type must be 'open' or 'closed'");
    return 1;
  }
  const layer = values.layer as string;
  if (layer !== "core" && layer !== "expanded") {
    console.error("--layer must be 'core' or 'expanded'");
    return 1;
  }

  const text = readFileSync(values["text-file"] as string, "utf8");

  const chunkSize = Number(process.env.CHUNK_SIZE ?? 512);
  const overlap = Number(process.env.CHUNK_OVERLAP ?? 64);
  const dim = Number(process.env.EMBEDDING_DIM ?? 768);
  const chunking = new ChunkingService({ chunkSize, overlap });

  const embedding: EmbeddingService = values["dry-run"]
    ? new DryRunEmbedding(dim)
    : new OllamaEmbeddingService({
        baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        model: process.env.EMBEDDING_MODEL ?? "nomic-embed-text",
        dimension: dim,
      });

  const prisma = new PrismaClient();
  const indexing = new IndexingService(prisma, chunking, embedding);

  try {
    const result = await indexing.indexPaper({
      title: values.title as string,
      authors: (values.authors as string[] | undefined) ?? [],
      year: Number(values.year),
      venue: values.venue as string,
      doi: values.doi as string | undefined,
      submodulePath: values["submodule-path"] as string,
      pdfHash: values["pdf-hash"] as string,
      accessType,
      layer,
      tags: (values.tags as string[] | undefined) ?? [],
      text,
    });
    console.log(
      `Paper ${result.paperId} indexed — ${result.chunksCreated} chunk(s) created`,
    );
    return 0;
  } catch (err) {
    console.error("Indexing failed:", (err as Error).message);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
