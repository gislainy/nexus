import type { FastifyPluginAsync } from "fastify";
import { createProjectRepository } from "../repositories/project.repository.js";
import { createCollaboratorRepository } from "../repositories/collaborator.repository.js";
import { createSessionRepository } from "../repositories/session.repository.js";
import { createAnswerRepository } from "../repositories/answer.repository.js";
import { createCollaboratorService } from "../services/collaborator.service.js";
import {
  createGapService,
  type GenerationService,
} from "../services/gap.service.js";

// POST /sessions/:sessionId/collaborators/:collaboratorId/complete
// Internal endpoint — called by C3 when a collaborator's EFSM reaches q_F.
// Response 200: { sessionStatus: SessionStatus }
// Response 404: { error: "Session not found" }
export const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  const projectRepository = createProjectRepository(fastify.prisma);
  const collaboratorRepository = createCollaboratorRepository(fastify.prisma);
  const sessionRepository = createSessionRepository(fastify.prisma);
  const answerRepository = createAnswerRepository(fastify.prisma);
  const service = createCollaboratorService(
    collaboratorRepository,
    projectRepository,
    sessionRepository,
  );

  // GenerationService stub — returns null until an LLM model is selected and
  // benchmarked. No real provider is connected in this task; dependency
  // injection lets the concrete implementation be swapped without code changes.
  const generationService: GenerationService = {
    async complete() {
      return null;
    },
  };
  const gapService = createGapService(answerRepository, generationService);

  fastify.post<{ Params: { sessionId: string; collaboratorId: string } }>(
    "/sessions/:sessionId/collaborators/:collaboratorId/complete",
    async (request, reply) => {
      const { sessionId, collaboratorId } = request.params;
      const status = await sessionRepository.findStatusById(sessionId);
      if (!status) {
        return reply.code(404).send({ error: "Session not found" });
      }
      const sessionStatus = await service.evaluateReadiness(sessionId);

      // The complete endpoint carries only sessionId and collaboratorId, but
      // findProfileByCollaboratorId is scoped by projectId, so resolve it from
      // the collaborator record first.
      const collaborator = await fastify.prisma.collaborator.findUnique({
        where: { id: collaboratorId },
        select: { projectId: true },
      });
      if (collaborator) {
        const profile = await collaboratorRepository.findProfileByCollaboratorId(
          collaborator.projectId,
          collaboratorId,
        );
        if (profile) {
          const gapResult = await gapService.analyzeGaps(
            sessionId,
            collaboratorId,
            profile.profileType,
          );
          if (gapResult.hasGap) {
            fastify.log.info({ gapResult }, "gap detected for collaborator");
          }
        }
      }

      return reply.code(200).send({ sessionStatus });
    },
  );
};
