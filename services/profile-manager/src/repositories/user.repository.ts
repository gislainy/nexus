import type { PrismaClient } from "@prisma/client";

export interface UserRepository {
  findByEmail(email: string): Promise<{ id: string; name: string } | null>;
}

// User identity is owned by services/auth/. Because every service shares the
// same PostgreSQL, C1 resolves the invitee directly on the `user` table instead
// of calling the auth service over HTTP. This is the ONLY operation C1 performs
// on `user` — read-only, selecting just `id` and `name`. Writes to `user` are
// exclusive to services/auth/.
export function createUserRepository(prisma: PrismaClient): UserRepository {
  return {
    async findByEmail(email) {
      return prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true },
      });
    },
  };
}
