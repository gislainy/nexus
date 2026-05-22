/**
 * LLM provider abstraction shared by every Nexus component that calls a model.
 * Implementations live in ./llm/ — Ollama (local/open) and OpenAI (proprietary).
 */

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

export interface LLMProvider {
  /** Stable identifier of the provider+model used (ex: "ollama/llama3.2"). */
  readonly name: string;
  complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;
  embed(text: string): Promise<number[]>;
}
