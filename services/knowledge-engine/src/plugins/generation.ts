import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import {
  OllamaGenerationService,
  type GenerationService,
} from "../services/generation.js";

declare module "fastify" {
  interface FastifyInstance {
    generation: GenerationService;
  }
}

export interface GenerationPluginOptions {
  generation?: GenerationService;
}

const generationPlugin: FastifyPluginAsync<GenerationPluginOptions> = async (
  fastify,
  opts,
) => {
  const generation: GenerationService =
    opts.generation ??
    new OllamaGenerationService({
      baseUrl:
        process.env.LLM_BASE_URL ??
        process.env.OLLAMA_BASE_URL ??
        "http://localhost:11434",
      model: process.env.LLM_MODEL ?? "llama3.2",
      maxTokens: Number(process.env.LLM_MAX_TOKENS ?? "1024"),
    });

  fastify.decorate("generation", generation);
};

export default fp(generationPlugin, { name: "generation" });
