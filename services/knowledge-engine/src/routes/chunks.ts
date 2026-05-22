import type { FastifyPluginAsync } from "fastify";

export const chunksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/chunks/:id", async (_request, reply) => {
    return reply.status(501).send({ error: "not_implemented" });
  });
};
