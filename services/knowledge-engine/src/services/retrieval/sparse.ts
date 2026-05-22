import { createRequire } from "node:module";
import type { PrismaClient } from "@prisma/client";
import type { RetrievalCandidate } from "./dense.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bm25Factory = require("wink-bm25-text-search") as () => Bm25Engine;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const winkUtils = require("wink-nlp-utils") as {
  string: {
    lowerCase: (s: string) => string;
    removeExtraSpaces: (s: string) => string;
    tokenize0: (s: string) => string[];
  };
  tokens: {
    removeWords: (t: string[]) => string[];
    stem: (t: string[]) => string[];
    propagateNegations: (t: string[]) => string[];
  };
};

interface Bm25Engine {
  defineConfig(cfg: { fldWeights: Record<string, number>; bm25Params?: { k1?: number; b?: number; k?: number } }): void;
  definePrepTasks(tasks: Array<(input: unknown) => unknown>): void;
  addDoc(doc: Record<string, string>, id: string): void;
  consolidate(): void;
  search(query: string, limit?: number): Array<[string, number]>;
  reset(): void;
}

interface ChunkRow {
  id: string;
  text: string;
  tags: string[];
}

export class SparseRetrievalService {
  private engine: Bm25Engine | null = null;
  private tagsByChunk = new Map<string, string[]>();
  private consolidated = false;

  constructor(private readonly prisma: PrismaClient) {}

  async buildIndex(): Promise<void> {
    const rows = await this.prisma.knowledgeChunk.findMany({
      where: { status: "active" },
      select: { id: true, text: true, tags: true },
    });
    this.indexFromRows(rows);
  }

  /** Test seam: build the index from in-memory rows without hitting the DB. */
  indexFromRows(rows: ChunkRow[]): void {
    const engine = bm25Factory();
    engine.defineConfig({ fldWeights: { text: 1 } });
    engine.definePrepTasks([
      winkUtils.string.lowerCase,
      winkUtils.string.removeExtraSpaces,
      winkUtils.string.tokenize0,
      winkUtils.tokens.removeWords,
      winkUtils.tokens.stem,
    ] as Array<(input: unknown) => unknown>);

    this.tagsByChunk.clear();
    for (const row of rows) {
      engine.addDoc({ text: row.text }, row.id);
      this.tagsByChunk.set(row.id, row.tags);
    }
    if (rows.length > 0) {
      engine.consolidate();
      this.consolidated = true;
    } else {
      this.consolidated = false;
    }
    this.engine = engine;
  }

  retrieve(queryText: string, topK: number, tag?: string): RetrievalCandidate[] {
    if (!this.engine || !this.consolidated) return [];
    const hits = this.engine.search(queryText);
    const filtered: RetrievalCandidate[] = [];
    for (const [chunkId, score] of hits) {
      if (tag) {
        const tags = this.tagsByChunk.get(chunkId) ?? [];
        if (!tags.includes(tag)) continue;
      }
      filtered.push({ chunkId, score });
      if (filtered.length >= topK) break;
    }
    return filtered;
  }
}
