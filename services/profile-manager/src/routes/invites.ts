import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { CreateInviteInput, ProfileType } from "@nexus/types";
import { createProjectRepository } from "../repositories/project.repository.js";
import { createUserRepository } from "../repositories/user.repository.js";
import { createInviteRepository } from "../repositories/invite.repository.js";
import { createInviteService } from "../services/invite.service.js";

const AcceptInviteBody = z.object({ confirmedProfile: ProfileType });

export const invitesRoutes: FastifyPluginAsync = async (fastify) => {
  const projectRepository = createProjectRepository(fastify.prisma);
  const userRepository = createUserRepository(fastify.prisma);
  const inviteRepository = createInviteRepository(fastify.prisma);
  const service = createInviteService(
    inviteRepository,
    userRepository,
    projectRepository,
    { info: (message) => fastify.log.info(message) },
  );

  // POST /projects/:projectId/invites — requires the inviter's JWT.
  fastify.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/invites",
    { preHandler: fastify.authenticateJwt },
    async (request, reply) => {
      const parsed = CreateInviteInput.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }
      try {
        const result = await service.createInvite(
          request.params.projectId,
          request.userId,
          parsed.data,
        );
        return reply.code(201).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        if (message === "Project not found") {
          return reply.code(404).send({ error: message });
        }
        if (
          message === "Collaborator already active" ||
          message === "Invite already pending for this email"
        ) {
          return reply.code(409).send({ error: message });
        }
        return reply.code(500).send({ error: message });
      }
    },
  );

  // GET /invites/:token — public: the guest may not have an account yet.
  fastify.get<{ Params: { token: string } }>(
    "/invites/:token",
    async (request, reply) => {
      try {
        const details = await service.getInviteByToken(request.params.token);
        return reply.code(200).send(details);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        if (message === "Invite not found or expired") {
          return reply.code(404).send({ error: message });
        }
        return reply.code(500).send({ error: message });
      }
    },
  );

  // POST /invites/:token/accept — public: the guest may accept before holding a
  // JWT, but the matching User must already exist (sign-up happens first).
  fastify.post<{ Params: { token: string } }>(
    "/invites/:token/accept",
    async (request, reply) => {
      const parsed = AcceptInviteBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }
      try {
        const result = await service.acceptInvite(
          request.params.token,
          parsed.data.confirmedProfile,
        );
        return reply.code(201).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        if (message === "Invite not found or expired") {
          return reply.code(404).send({ error: message });
        }
        if (message === "User not found for invite email") {
          return reply.code(422).send({ error: message });
        }
        return reply.code(500).send({ error: message });
      }
    },
  );

  // POST /invites/:token/decline — public.
  fastify.post<{ Params: { token: string } }>(
    "/invites/:token/decline",
    async (request, reply) => {
      try {
        await service.declineInvite(request.params.token);
        return reply.code(200).send({ status: "DECLINED" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        if (message === "Invite not found or expired") {
          return reply.code(404).send({ error: message });
        }
        return reply.code(500).send({ error: message });
      }
    },
  );
};
