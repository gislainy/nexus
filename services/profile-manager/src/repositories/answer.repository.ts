import type { PrismaClient } from "@prisma/client";

export interface DimensionAnswerStats {
  dimension: string;
  total: number;
  uncertainOrDelegated: number;
}

export interface ConfidentAnswer {
  id: string;
  value: string;
  epistemicConfidence: number;
}

export interface AnswerRepository {
  getDimensionStatsForCollaborator(
    sessionId: string,
    collaboratorId: string,
  ): Promise<DimensionAnswerStats[]>;
  findConfidentAnswersForInstance(
    questionInstanceId: string,
    minEpistemicConfidence: number,
  ): Promise<ConfidentAnswer[]>;
}

export function createAnswerRepository(
  prisma: PrismaClient,
): AnswerRepository {
  return {
    async getDimensionStatsForCollaborator(sessionId, collaboratorId) {
      const rows = await prisma.$queryRaw<
        { dimension: string; total: bigint; uncertain_or_delegated: bigint }[]
      >`
        SELECT qi."dimension" AS dimension,
               COUNT(*)::bigint AS total,
               COUNT(*) FILTER (
                 WHERE a."confidence" IN ('UNCERTAIN', 'DELEGATED')
               )::bigint AS uncertain_or_delegated
        FROM "answer" a
        JOIN "question_instance" qi ON qi."id" = a."question_instance_id"
        WHERE a."session_id" = ${sessionId}
          AND a."collaborator_id" = ${collaboratorId}
        GROUP BY qi."dimension"
      `;
      return rows.map((row) => ({
        dimension: row.dimension,
        total: Number(row.total),
        uncertainOrDelegated: Number(row.uncertain_or_delegated),
      }));
    },

    async findConfidentAnswersForInstance(
      questionInstanceId,
      minEpistemicConfidence,
    ) {
      const answers = await prisma.answer.findMany({
        where: {
          questionInstanceId,
          epistemicConfidence: { gt: minEpistemicConfidence },
        },
        select: { id: true, value: true, epistemicConfidence: true },
      });
      return answers.map((answer) => ({
        id: answer.id,
        value: answer.value,
        epistemicConfidence: answer.epistemicConfidence,
      }));
    },
  };
}
