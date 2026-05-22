import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const RetrievalRequestSchema = z.object({
  queryText: z.string().min(1),
  topK: z.number().int().positive(),
  tag: z.string().optional(),
});

export const retrieveRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/retrieve", async (request, reply) => {
    const parsed = RetrievalRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request", issues: parsed.error.issues });
    }
    return reply.status(501).send({ error: "not_implemented" });
  });
};
