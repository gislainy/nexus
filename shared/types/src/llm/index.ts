import type { LLMProvider } from "../llm.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAIProvider } from "./openai.js";

export type LLMProviderName = "ollama" | "openai";

export interface CreateLLMProviderOptions {
  provider: LLMProviderName;
  model?: string;
  embeddingModel?: string;
  baseUrl?: string;
  apiKey?: string;
}

export function createLLMProvider(
  options: CreateLLMProviderOptions,
): LLMProvider {
  switch (options.provider) {
    case "ollama":
      return new OllamaProvider({
        baseUrl: options.baseUrl,
        model: options.model,
        embeddingModel: options.embeddingModel,
      });
    case "openai":
      return new OpenAIProvider({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        model: options.model,
        embeddingModel: options.embeddingModel,
      });
    default: {
      const exhaustive: never = options.provider;
      throw new Error(`Unknown LLM provider: ${String(exhaustive)}`);
    }
  }
}

export { OllamaProvider } from "./ollama.js";
export { OpenAIProvider } from "./openai.js";
