import type { EmbeddingService } from "../../src/services/embedding.js";

export class DryRunEmbedding implements EmbeddingService {
  readonly modelName = "dry-run";
  readonly dimension: number;
  constructor(dim: number) {
    this.dimension = dim;
  }
  async embed(_text: string): Promise<number[]> {
    return new Array(this.dimension).fill(0);
  }
}
