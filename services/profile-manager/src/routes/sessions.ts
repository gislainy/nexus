import type { FastifyPluginAsync } from "fastify";
import { createProjectRepository } from "../repositories/project.repository.js";
import { createCollaboratorRepository } from "../repositories/collaborator.repository.js";
import { createSessionRepository } from "../repositories/session.repository.js";
import { createCollaboratorService } from "../services/collaborator.service.js";

// POST /sessions/:sessionId/collaborators/:collaboratorId/complete
// Internal endpoint — called by C3 when a collaborator's EFSM reaches q_F.
// Response 200: { sessionStatus: SessionStatus }
// Response 404: { error: "Session not found" }
export const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  const projectRepository = createProjectRepository(fastify.prisma);
  const collaboratorRepository = createCollaboratorRepository(fastify.prisma);
  const sessionRepository = createSessionRepository(fastify.prisma);
  const service = createCollaboratorService(
    collaboratorRepository,
    projectRepository,
    sessionRepository,
  );

  fastify.post<{ Params: { sessionId: string; collaboratorId: string } }>(
    "/sessions/:sessionId/collaborators/:collaboratorId/complete",
    async (request, reply) => {
      const { sessionId } = request.params;
      const status = await sessionRepository.findStatusById(sessionId);
      if (!status) {
        return reply.code(404).send({ error: "Session not found" });
      }
      const sessionStatus = await service.evaluateReadiness(sessionId);
      return reply.code(200).send({ sessionStatus });
    },
  );
};
