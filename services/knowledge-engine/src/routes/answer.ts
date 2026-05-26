import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { GenerationPassage } from "../services/generation.js";

const AnswerRequestSchema = z.object({
  queryText: z.string().min(1),
  topK: z.number().int().positive().default(8),
  tag: z.string().optional(),
});

export const answerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/answer", async (request, reply) => {
    const parsed = AnswerRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "invalid_request", issues: parsed.error.issues });
    }

    const { queryText, topK, tag } = parsed.data;

    let retrieval;
    try {
      retrieval = await fastify.retrieval.retrieve({ queryText, topK, tag });
    } catch (err) {
      fastify.log.error({ err }, "retrieval failed");
      return reply.status(500).send({ error: "retrieval_failed" });
    }

    if (!retrieval.hasEvidence) {
      return reply.send({
        hasEvidence: false,
        answer: null,
        citedSpans: [],
        passages: [],
      });
    }

    const passages: GenerationPassage[] = retrieval.passages.map((p) => ({
      chunkId: p.chunkId,
      text: p.text,
      claim: p.claim,
      source: p.source,
    }));

    try {
      const gen = await fastify.generation.generate({ queryText, passages });
      return reply.send({
        hasEvidence: true,
        answer: gen.answer,
        citedSpans: gen.citedSpans,
        hasGrounding: gen.hasGrounding,
        model: gen.model,
        latencyMs: gen.latencyMs,
        passages: retrieval.passages,
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("Ollama generation unavailable")) {
        return reply.status(503).send({ error: "generation_unavailable" });
      }
      fastify.log.error({ err }, "generation failed");
      return reply.status(500).send({ error: "generation_failed" });
    }
  });
};
