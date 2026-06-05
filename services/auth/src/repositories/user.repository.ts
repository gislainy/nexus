import type { PrismaClient } from "@prisma/client";

export interface UserRepository {
  findByEmail(
    email: string,
  ): Promise<{
    id: string;
    email: string;
    passwordHash: string;
    name: string;
  } | null>;
  findById(
    id: string,
  ): Promise<{ id: string; email: string; name: string } | null>;
  create(input: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<{ id: string }>;
  saveRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void>;
  findRefreshToken(
    token: string,
  ): Promise<{ userId: string; expiresAt: Date } | null>;
  deleteRefreshToken(token: string): Promise<void>;
}

export function createUserRepository(prisma: PrismaClient): UserRepository {
  return {
    async findByEmail(email) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, passwordHash: true, name: true },
      });
      return user;
    },

    async findById(id) {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true },
      });
      return user;
    },

    async create(input) {
      const user = await prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          name: input.name,
        },
        select: { id: true },
      });
      return user;
    },

    async saveRefreshToken(userId, token, expiresAt) {
      await prisma.refreshToken.create({
        data: { userId, token, expiresAt },
      });
    },

    async findRefreshToken(token) {
      const record = await prisma.refreshToken.findUnique({
        where: { token },
        select: { userId: true, expiresAt: true },
      });
      return record;
    },

    async deleteRefreshToken(token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    },
  };
}
