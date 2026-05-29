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
import { detectConflict } from "../services/conflict.service.js";
import { QuestionInputType } from "@nexus/types";
import { z } from "zod";

const EPISTEMIC_CONFLICT_THRESHOLD = 0.7;

const CheckConflictBody = z.object({
  questionInstanceId: z.string(),
  newAnswer: z.object({
    value: z.string(),
    inputType: QuestionInputType,
    collaboratorId: z.string(),
    epistemicConfidence: z.number(),
  }),
});

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

  // POST /sessions/:sessionId/force-advance
  // Lets the project owner advance a session stuck in AWAITING_DELEGATION,
  // accepting the existing delegation gaps and moving to argumentation.
  fastify.post<{
    Params: { sessionId: string };
    Body: { reason?: string };
  }>("/sessions/:sessionId/force-advance", async (request, reply) => {
    try {
      const sessionStatus = await service.forceAdvance(request.params.sessionId);
      return reply.code(200).send({ sessionStatus });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      if (message === "Session not found") {
        return reply.code(404).send({ error: message });
      }
      if (message === "Session is not in AWAITING_DELEGATION status") {
        return reply.code(400).send({ error: message });
      }
      return reply.code(500).send({ error: message });
    }
  });

  // GET /sessions/:sessionId/status
  // Exposes the current session state and the count of pending delegations.
  fastify.get<{ Params: { sessionId: string } }>(
    "/sessions/:sessionId/status",
    async (request, reply) => {
      const { sessionId } = request.params;
      const result =
        await sessionRepository.findStatusWithPendingDelegations(sessionId);
      if (!result) {
        return reply.code(404).send({ error: "Session not found" });
      }
      return reply.code(200).send({
        sessionId,
        status: result.status,
        pendingDelegations: result.pendingDelegations,
      });
    },
  );

  // POST /sessions/:sessionId/answers/check-conflict
  // Internal endpoint called by C3 before persisting an answer. Detects whether
  // the incoming answer contradicts another collaborator's high-confidence
  // answer for the same question instance.
  fastify.post<{ Params: { sessionId: string } }>(
    "/sessions/:sessionId/answers/check-conflict",
    async (request, reply) => {
      const { sessionId } = request.params;
      const parsed = CheckConflictBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
      }

      const status = await sessionRepository.findStatusById(sessionId);
      if (!status) {
        return reply.code(404).send({ error: "Session not found" });
      }

      const { questionInstanceId, newAnswer } = parsed.data;
      const existingAnswers =
        await answerRepository.findConfidentAnswersForInstance(
          questionInstanceId,
          EPISTEMIC_CONFLICT_THRESHOLD,
        );
      const result = detectConflict(newAnswer, existingAnswers);

      if (result.hasConflict) {
        fastify.log.info(
          {
            sessionId,
            questionInstanceId,
            inputType: newAnswer.inputType,
            collaboratorId: newAnswer.collaboratorId,
            conflictingAnswerId: result.conflictingAnswerId,
          },
          "answer conflict detected",
        );
      }

      return reply.code(200).send(result);
    },
  );
};
