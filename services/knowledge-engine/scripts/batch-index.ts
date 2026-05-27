#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { ChunkingService } from "../src/services/chunking.js";
import {
  OllamaEmbeddingService,
  TransformersEmbeddingService,
  type EmbeddingService,
} from "../src/services/embedding.js";
import { IndexingService } from "../src/services/indexing.js";
import { DryRunEmbedding } from "./shared/embedding.js";

export interface ManifestEntry {
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
  textFile: string;
}

export interface Manifest {
  papers: ManifestEntry[];
}

export function parseManifest(raw: string): Manifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid JSON: ${(err as Error).message}`);
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as Manifest).papers)
  ) {
    throw new Error("manifest must have a 'papers' array");
  }
  return parsed as Manifest;
}

export interface BatchIndexDeps {
  indexing: Pick<IndexingService, "indexPaper">;
  baseDir: string;
  readFile: (path: string) => string;
  exists: (path: string) => boolean;
  log: (msg: string) => void;
}

export interface BatchIndexResult {
  indexed: number;
  totalChunks: number;
  skipped: number;
}

export async function runBatchIndex(
  manifest: Manifest,
  deps: BatchIndexDeps,
): Promise<BatchIndexResult> {
  const total = manifest.papers.length;
  let indexed = 0;
  let totalChunks = 0;
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    const entry = manifest.papers[i]!;
    const textPath = isAbsolute(entry.textFile)
      ? entry.textFile
      : resolve(deps.baseDir, entry.textFile);

    if (!deps.exists(textPath)) {
      deps.log(`[SKIP] ${entry.title} — textFile not found: ${textPath}`);
      skipped++;
      continue;
    }

    const text = deps.readFile(textPath);
    deps.log(`[${i + 1}/${total}] Indexing: ${entry.title}`);
    const result = await deps.indexing.indexPaper({
      title: entry.title,
      authors: entry.authors,
      year: entry.year,
      venue: entry.venue,
      doi: entry.doi,
      submodulePath: entry.submodulePath,
      pdfHash: entry.pdfHash,
      accessType: entry.accessType,
      layer: entry.layer,
      tags: entry.tags,
      text,
    });
    deps.log(`  → paperId=${result.paperId}, chunks=${result.chunksCreated}`);
    indexed++;
    totalChunks += result.chunksCreated;
  }

  return { indexed, totalChunks, skipped };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      manifest: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (!values.manifest) {
    console.error("Missing required --manifest");
    return 1;
  }

  const manifestPath = resolve(values.manifest as string);
  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    return 1;
  }

  let manifest: Manifest;
  try {
    manifest = parseManifest(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    console.error(`Invalid manifest: ${(err as Error).message}`);
    return 1;
  }

  const baseDir = dirname(manifestPath);
  const chunkSize = Number(process.env.CHUNK_SIZE ?? 512);
  const overlap = Number(process.env.CHUNK_OVERLAP ?? 64);
  const dim = Number(process.env.EMBEDDING_DIM ?? 768);
  const chunking = new ChunkingService({ chunkSize, overlap });

  const provider = process.env.EMBEDDING_PROVIDER ?? "transformers";
  const embedding: EmbeddingService = values["dry-run"]
    ? new DryRunEmbedding(dim)
    : provider === "ollama"
      ? new OllamaEmbeddingService({
          baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
          model: process.env.EMBEDDING_MODEL ?? "nomic-embed-text",
          dimension: dim,
        })
      : new TransformersEmbeddingService({
          model: process.env.EMBEDDING_MODEL ?? "Xenova/bge-large-en-v1.5",
          dimension: dim,
          quantized: process.env.EMBEDDING_QUANTIZED !== "false",
        });

  const prisma = new PrismaClient();
  const indexing = new IndexingService(prisma, chunking, embedding);

  try {
    const result = await runBatchIndex(manifest, {
      indexing,
      baseDir,
      readFile: (p) => readFileSync(p, "utf8"),
      exists: (p) => existsSync(p),
      log: (m) => console.log(m),
    });

    console.log("─────────────────────────────────");
    console.log(`Indexed: ${result.indexed} papers`);
    console.log(`Chunks:  ${result.totalChunks} total`);
    console.log(`Skipped: ${result.skipped} (textFile not found)`);
    console.log("─────────────────────────────────");
    return 0;
  } catch (err) {
    console.error("Batch indexing failed:", (err as Error).message);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("batch-index.ts") ||
  process.argv[1]?.endsWith("batch-index.js");

if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
