import type { FastifyPluginAsync } from "fastify";
import { createLLMProvider, type LLMProviderName } from "@nexus/types";
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

  // GenerationService wraps the shared LLMProvider, exposing only the
  // string-in/string-out contract the gap service depends on. It is invoked
  // exclusively when a diffuse gap pattern is detected.
  const provider = createLLMProvider({
    provider: (process.env.LLM_PROVIDER as LLMProviderName) ?? "ollama",
    baseUrl: process.env.LLM_BASE_URL ?? process.env.OLLAMA_BASE_URL,
    model: process.env.LLM_MODEL,
  });
  const generationService: GenerationService = {
    async complete(prompt) {
      const result = await provider.complete(prompt);
      return result.text;
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
