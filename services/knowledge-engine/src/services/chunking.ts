import { getEncoding, type Tiktoken } from "js-tiktoken";

export interface ChunkingOptions {
  chunkSize: number;
  overlap: number;
}

export interface TextChunk {
  text: string;
  pageRef?: string;
}

const MIN_CHUNK_TOKENS = 50;

export class ChunkingService {
  private readonly chunkSize: number;
  private readonly overlap: number;
  private readonly encoder: Tiktoken;

  constructor(options: ChunkingOptions) {
    if (options.chunkSize <= 0) {
      throw new Error("chunkSize must be > 0");
    }
    if (options.overlap < 0 || options.overlap >= options.chunkSize) {
      throw new Error("overlap must be >= 0 and < chunkSize");
    }
    this.chunkSize = options.chunkSize;
    this.overlap = options.overlap;
    this.encoder = getEncoding("cl100k_base");
  }

  chunk(text: string): TextChunk[] {
    const tokens = this.encoder.encode(text);
    if (tokens.length === 0) return [];

    const step = this.chunkSize - this.overlap;
    const chunks: TextChunk[] = [];

    for (let start = 0; start < tokens.length; start += step) {
      const window = tokens.slice(start, start + this.chunkSize);
      if (window.length < MIN_CHUNK_TOKENS) {
        if (start === 0) {
          // single very short doc — still drop per spec
        }
        break;
      }
      const chunkText = this.encoder.decode(window);
      chunks.push({ text: chunkText });
      if (start + this.chunkSize >= tokens.length) break;
    }

    return chunks;
  }
}
