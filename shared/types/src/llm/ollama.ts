import { fetch } from "undici";
import type {
  CompletionOptions,
  CompletionResult,
  LLMProvider,
} from "../llm.js";

export interface OllamaProviderConfig {
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
}

interface OllamaGenerateResponse {
  response: string;
  model: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbeddingsResponse {
  embedding: number[];
}

export class OllamaProvider implements LLMProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly embeddingModel: string;

  constructor(config: OllamaProviderConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
    this.defaultModel = config.model ?? "llama3.2";
    this.embeddingModel = config.embeddingModel ?? "nomic-embed-text";
    this.name = `ollama/${this.defaultModel}`;
  }

  async complete(
    prompt: string,
    options: CompletionOptions = {},
  ): Promise<CompletionResult> {
    const model = options.model ?? this.defaultModel;
    const body = {
      model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
      },
    };

    const start = Date.now();
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      throw new Error(`Ollama generate failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as OllamaGenerateResponse;
    return {
      text: data.response,
      model: data.model,
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
      latencyMs,
    };
  }

  async embed(text: string): Promise<number[]> {
    const body = { model: this.embeddingModel, prompt: text };
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Ollama embeddings failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as OllamaEmbeddingsResponse;
    return data.embedding;
  }
}
