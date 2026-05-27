export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  readonly modelName: string;
  readonly dimension: number;
}

export interface OllamaEmbeddingOptions {
  baseUrl: string;
  model: string;
  dimension: number;
  fetchImpl?: typeof fetch;
}

export class OllamaEmbeddingService implements EmbeddingService {
  readonly modelName: string;
  readonly dimension: number;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OllamaEmbeddingOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.modelName = opts.model;
    this.dimension = opts.dimension;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async embed(text: string): Promise<number[]> {
    const url = `${this.baseUrl}/api/embeddings`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.modelName, prompt: text }),
      });
    } catch (err) {
      throw new Error(
        `Failed to reach Ollama at ${url}: ${(err as Error).message}`,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Ollama embedding request failed: ${res.status} ${res.statusText} ${body}`,
      );
    }
    const data = (await res.json()) as { embedding?: number[] };
    if (!Array.isArray(data.embedding)) {
      throw new Error("Ollama response missing 'embedding' array");
    }
    return data.embedding;
  }
}

import { pipeline } from "@xenova/transformers";

type FeatureExtractionPipeline = Awaited<ReturnType<typeof pipeline<"feature-extraction">>>;

export interface TransformersEmbeddingOptions {
  model: string;
  dimension: number;
  quantized?: boolean;
}

export class TransformersEmbeddingService implements EmbeddingService {
  readonly modelName: string;
  readonly dimension: number;
  private readonly modelId: string;
  private readonly quantized: boolean;
  private extractor: FeatureExtractionPipeline | null = null;

  constructor(opts: TransformersEmbeddingOptions) {
    this.modelId = opts.model;
    this.modelName = opts.model;
    this.dimension = opts.dimension;
    this.quantized = opts.quantized ?? false;
  }

  private async getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!this.extractor) {
      this.extractor = await pipeline("feature-extraction", this.modelId, {
        quantized: this.quantized,
      });
    }
    return this.extractor;
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor([text], { normalize: true, pooling: "cls" });
    return Array.from(output.data as Float32Array);
  }
}
