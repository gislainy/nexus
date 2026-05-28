import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { InviteCollaboratorInput, ProfileType } from "@nexus/types";
import { createProjectRepository } from "../repositories/project.repository.js";
import { createCollaboratorRepository } from "../repositories/collaborator.repository.js";
import { createCollaboratorService } from "../services/collaborator.service.js";

const PatchProfileBody = z.object({ profileType: ProfileType });

export const collaboratorsRoutes: FastifyPluginAsync = async (fastify) => {
  const projectRepository = createProjectRepository(fastify.prisma);
  const collaboratorRepository = createCollaboratorRepository(fastify.prisma);
  const service = createCollaboratorService(
    collaboratorRepository,
    projectRepository,
  );

  fastify.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/collaborators",
    async (request, reply) => {
      const parsed = InviteCollaboratorInput.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }
      try {
        const result = await service.inviteCollaborator({
          projectId: request.params.projectId,
          name: parsed.data.name,
          email: parsed.data.email,
          suggestedProfile: parsed.data.suggestedProfile,
        });
        return reply.code(201).send({
          collaboratorId: result.collaboratorId,
          profileType: result.profileType,
          createdAt: result.createdAt.toISOString(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        if (message === "Project not found") {
          return reply.code(404).send({ error: message });
        }
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.get<{ Params: { projectId: string; collaboratorId: string } }>(
    "/projects/:projectId/collaborators/:collaboratorId/profile",
    async (request, reply) => {
      try {
        const profile = await service.getProfile(
          request.params.projectId,
          request.params.collaboratorId,
        );
        return reply.code(200).send(profile);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        if (message === "Collaborator not found") {
          return reply.code(404).send({ error: message });
        }
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.patch<{ Params: { projectId: string; collaboratorId: string } }>(
    "/projects/:projectId/collaborators/:collaboratorId/profile",
    async (request, reply) => {
      const parsed = PatchProfileBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }
      try {
        const profile = await service.patchProfile({
          projectId: request.params.projectId,
          collaboratorId: request.params.collaboratorId,
          profileType: parsed.data.profileType,
        });
        return reply.code(200).send(profile);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        if (message === "Collaborator not found") {
          return reply.code(404).send({ error: message });
        }
        return reply.code(500).send({ error: message });
      }
    },
  );
};
