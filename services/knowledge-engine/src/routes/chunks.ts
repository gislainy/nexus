import type { FastifyPluginAsync } from "fastify";

export const chunksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>("/chunks/:id", async (request, reply) => {
    const { id } = request.params;
    const chunk = await fastify.prisma.knowledgeChunk.findUnique({
      where: { id },
      include: { paper: true },
    });
    if (!chunk) {
      return reply.status(404).send({ error: "chunk_not_found" });
    }
    return reply.send({
      chunkId: chunk.id,
      text: chunk.text,
      claim: chunk.claim ?? undefined,
      layer: chunk.layer,
      source: {
        authors: chunk.paper.authors,
        year: chunk.paper.year,
        title: chunk.paper.title,
        venue: chunk.paper.venue,
        pageRef: chunk.pageRef ?? undefined,
      },
    });
  });
};
