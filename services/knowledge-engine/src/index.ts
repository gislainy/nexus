import Fastify from "fastify";
import prismaPlugin from "./plugins/prisma.js";
import retrievalPlugin from "./plugins/retrieval.js";
import type { EmbeddingService } from "./services/embedding.js";
import { healthRoutes } from "./routes/health.js";
import { retrieveRoutes } from "./routes/retrieve.js";
import { chunksRoutes } from "./routes/chunks.js";

export async function buildServer(
  opts: { withPrisma?: boolean; embedding?: EmbeddingService } = {},
) {
  const fastify = Fastify({ logger: true });

  if (opts.withPrisma !== false) {
    await fastify.register(prismaPlugin);
    await fastify.register(retrievalPlugin, { embedding: opts.embedding });
  }

  await fastify.register(healthRoutes);
  await fastify.register(retrieveRoutes);
  await fastify.register(chunksRoutes);

  return fastify;
}

async function main() {
  const server = await buildServer();
  const port = Number(process.env.PORT ?? 8004);

  const shutdown = async (signal: string) => {
    server.log.info({ signal }, "shutting down");
    await server.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  try {
    await server.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

const isEntrypoint = import.meta.url === `file://${process.argv[1]}`;
if (isEntrypoint) {
  void main();
}
