import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createProjectRepository } from "../repositories/project.repository.js";
import { createProjectService } from "../services/project.service.js";

const CreateProjectBody = z.object({
  name: z.string().min(1),
  description: z.string(),
  domainConfigId: z.string().uuid().optional(),
});

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = createProjectRepository(fastify.prisma);
  const service = createProjectService(repository);

  fastify.post(
    "/projects",
    { preHandler: fastify.authenticateJwt },
    async (request, reply) => {
      const parsed = CreateProjectBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }
      try {
        const result = await service.createProject({
          ...parsed.data,
          ownerUserId: request.userId,
          ownerEmail: request.userEmail || undefined,
        });
        return reply.code(201).send({
          projectId: result.projectId,
          sessionId: result.sessionId,
          createdAt: result.createdAt.toISOString(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.get(
    "/projects",
    { preHandler: fastify.authenticateJwt },
    async (request, reply) => {
      try {
        const result = await service.listProjects(request.userId);
        return reply.code(200).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/context",
    { preHandler: fastify.authenticateJwt },
    async (request, reply) => {
      try {
        const context = await service.getProjectContext(
          request.params.projectId,
        );
        return reply.code(200).send(context);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        if (message === "Project not found") {
          return reply.code(404).send({ error: message });
        }
        return reply.code(500).send({ error: message });
      }
    },
  );
};
