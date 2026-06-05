import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    isServiceCall: boolean;
  }
  interface FastifyInstance {
    authenticateJwt: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    authenticateService: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }
  const serviceKey = process.env.SERVICE_API_KEY;
  if (!serviceKey) {
    throw new Error("SERVICE_API_KEY is required");
  }

  fastify.decorateRequest("userId", "");
  fastify.decorateRequest("isServiceCall", false);

  // Mode 1 — user JWT: validates `Authorization: Bearer <token>` and populates
  // request.userId with the token subject. Used by user-facing endpoints.
  fastify.decorate(
    "authenticateJwt",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const header = request.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      const token = header.slice("Bearer ".length);
      try {
        const payload = jwt.verify(token, jwtSecret);
        if (
          typeof payload === "object" &&
          payload !== null &&
          typeof payload.sub === "string"
        ) {
          request.userId = payload.sub;
          return;
        }
        await reply.code(401).send({ error: "Unauthorized" });
      } catch {
        await reply.code(401).send({ error: "Unauthorized" });
      }
    },
  );

  // Mode 2 — service key: validates the `X-Service-Key` header against
  // SERVICE_API_KEY. Used by internal endpoints called by other services (C3).
  fastify.decorate(
    "authenticateService",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const key = request.headers["x-service-key"];
      if (typeof key !== "string" || key !== serviceKey) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      request.isServiceCall = true;
    },
  );
};

export default fp(authPlugin, { name: "auth" });
