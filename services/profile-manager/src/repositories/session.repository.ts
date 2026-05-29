import type { PrismaClient } from "@prisma/client";
import type { SessionStatus } from "@nexus/types";

export interface SessionRepository {
  findStatusById(sessionId: string): Promise<SessionStatus | null>;
  updateStatus(sessionId: string, status: SessionStatus): Promise<void>;
  countPendingDelegations(sessionId: string): Promise<number>;
  forceAdvance(sessionId: string): Promise<SessionStatus>;
  findStatusWithPendingDelegations(
    sessionId: string,
  ): Promise<{ status: SessionStatus; pendingDelegations: number } | null>;
}

export function createSessionRepository(
  prisma: PrismaClient,
): SessionRepository {
  return {
    async findStatusById(sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { status: true },
      });
      return session?.status ?? null;
    },

    async updateStatus(sessionId, status) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { status },
      });
    },

    async countPendingDelegations(sessionId) {
      const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM "answer" d
        WHERE d."session_id" = ${sessionId}
          AND d."confidence" = 'DELEGATED'
          AND NOT EXISTS (
            SELECT 1
            FROM "answer" r
            WHERE r."question_instance_id" = d."question_instance_id"
              AND r."confidence" <> 'DELEGATED'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    },

    async forceAdvance(sessionId) {
      const next: SessionStatus = "READY_FOR_ARGUMENTATION";
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: next },
      });
      return next;
    },

    async findStatusWithPendingDelegations(sessionId) {
      const status = await this.findStatusById(sessionId);
      if (!status) {
        return null;
      }
      const pendingDelegations = await this.countPendingDelegations(sessionId);
      return { status, pendingDelegations };
    },
  };
}
