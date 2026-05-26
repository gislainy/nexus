import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const CreateExperimentSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  experimentType: z.enum(["embedding_model", "retrieval_strategy", "combined"]),
  candidates: z.array(z.string().min(1)).min(1),
  groundTruthId: z.string().min(1),
});

export const benchmarkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/benchmark/experiments", async (request, reply) => {
    const parsed = CreateExperimentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request", issues: parsed.error.issues });
    }
    const gt = await fastify.prisma.iRGroundTruth.findUnique({
      where: { id: parsed.data.groundTruthId },
      select: { id: true },
    });
    if (!gt) {
      return reply.status(404).send({ error: "ground_truth_not_found" });
    }
    const exp = await fastify.prisma.iRBenchmarkExperiment.create({
      data: { ...parsed.data, status: "PLANNED" },
    });
    return reply.status(201).send({ id: exp.id, status: exp.status });
  });

  fastify.get<{ Params: { id: string } }>(
    "/benchmark/experiments/:id",
    async (request, reply) => {
      const exp = await fastify.prisma.iRBenchmarkExperiment.findUnique({
        where: { id: request.params.id },
        include: { results: true },
      });
      if (!exp) {
        return reply.status(404).send({ error: "experiment_not_found" });
      }
      return reply.send(exp);
    },
  );
};
