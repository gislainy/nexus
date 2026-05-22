import type {
  CompletionOptions,
  CompletionResult,
  LLMProvider,
} from "./llm.js";

/**
 * Minimal Prisma client surface required to insert benchmark records.
 * Typed locally so the package does not import the generated client at build time.
 */
export interface BenchmarkRecorderPrismaClient {
  lLMBenchmarkRecord: {
    create(args: {
      data: {
        experimentId?: string | null;
        provider: string;
        component: string;
        task: string;
        prompt: string;
        response: string;
        latencyMs: number;
        tokensIn: number;
        tokensOut: number;
        timestamp: Date;
      };
    }): Promise<unknown>;
  };
}

export interface BenchmarkContext {
  component: string;
  task: string;
  experimentId?: string;
}

/**
 * Wraps any LLMProvider so every complete() and embed() call is persisted as an
 * LLMBenchmarkRecord. The wrapping is transparent to the caller — the returned
 * value is itself an LLMProvider.
 */
export class BenchmarkRecorder {
  static wrap(
    provider: LLMProvider,
    prisma: BenchmarkRecorderPrismaClient,
    context: BenchmarkContext,
  ): LLMProvider {
    return new Proxy(provider, {
      get(target, prop, receiver) {
        if (prop === "complete") {
          return async (prompt: string, options?: CompletionOptions) => {
            const result: CompletionResult = await target.complete(prompt, options);
            try {
              await prisma.lLMBenchmarkRecord.create({
                data: {
                  experimentId: context.experimentId ?? null,
                  provider: provider.name,
                  component: context.component,
                  task: context.task,
                  prompt,
                  response: result.text,
                  latencyMs: result.latencyMs,
                  tokensIn: result.promptTokens,
                  tokensOut: result.completionTokens,
                  timestamp: new Date(),
                },
              });
            } catch {
              // Recording must never break the underlying LLM call.
            }
            return result;
          };
        }
        if (prop === "embed") {
          return async (text: string) => {
            const start = Date.now();
            const vector = await target.embed(text);
            const latencyMs = Date.now() - start;
            try {
              await prisma.lLMBenchmarkRecord.create({
                data: {
                  experimentId: context.experimentId ?? null,
                  provider: provider.name,
                  component: context.component,
                  task: `${context.task}:embed`,
                  prompt: text,
                  response: `vector(${vector.length})`,
                  latencyMs,
                  tokensIn: 0,
                  tokensOut: 0,
                  timestamp: new Date(),
                },
              });
            } catch {
              // ignored
            }
            return vector;
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
}
