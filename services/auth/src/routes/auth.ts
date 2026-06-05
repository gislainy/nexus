import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { LoginInput, RegisterInput } from "@nexus/types";
import { createUserRepository } from "../repositories/user.repository.js";
import { createAuthService } from "../services/auth.service.js";

const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

function extractUserId(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (typeof payload === "object" && typeof payload.sub === "string") {
      return payload.sub;
    }
    return null;
  } catch {
    return null;
  }
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = createUserRepository(fastify.prisma);
  const service = createAuthService(repository);

  fastify.post("/auth/register", async (request, reply) => {
    const parsed = RegisterInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }
    try {
      const tokens = await service.register(parsed.data);
      return reply.code(201).send(tokens);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      if (message === "Email already registered") {
        return reply.code(409).send({ error: message });
      }
      return reply.code(500).send({ error: message });
    }
  });

  fastify.post("/auth/login", async (request, reply) => {
    const parsed = LoginInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }
    try {
      const tokens = await service.login(parsed.data);
      return reply.code(200).send(tokens);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      if (message === "Invalid credentials") {
        return reply.code(401).send({ error: message });
      }
      return reply.code(500).send({ error: message });
    }
  });

  fastify.post("/auth/refresh", async (request, reply) => {
    const parsed = RefreshBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }
    try {
      const result = await service.refresh(parsed.data.refreshToken);
      return reply.code(200).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      if (
        message === "Invalid refresh token" ||
        message === "Refresh token expired"
      ) {
        return reply.code(401).send({ error: message });
      }
      return reply.code(500).send({ error: message });
    }
  });

  fastify.get("/auth/me", async (request, reply) => {
    const userId = extractUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    try {
      const user = await service.getUser(userId);
      return reply.code(200).send(user);
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
};
