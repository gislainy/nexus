import OpenAI from "openai";
import type {
  CompletionOptions,
  CompletionResult,
  LLMProvider,
} from "../llm.js";

export interface OpenAIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
}

export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly embeddingModel: string;

  constructor(config: OpenAIProviderConfig = {}) {
    this.defaultModel = config.model ?? "gpt-4o-mini";
    this.embeddingModel = config.embeddingModel ?? "text-embedding-3-small";
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY ?? "",
      baseURL: config.baseUrl,
    });
    this.name = `openai/${this.defaultModel}`;
  }

  async complete(
    prompt: string,
    options: CompletionOptions = {},
  ): Promise<CompletionResult> {
    const model = options.model ?? this.defaultModel;
    const start = Date.now();
    const response = await this.client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });
    const latencyMs = Date.now() - start;
    const choice = response.choices[0];
    return {
      text: choice?.message?.content ?? "",
      model: response.model,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      latencyMs,
    };
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    const first = response.data[0];
    if (!first) {
      throw new Error("OpenAI embeddings returned no vectors");
    }
    return first.embedding;
  }
}
