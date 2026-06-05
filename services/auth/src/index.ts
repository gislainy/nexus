import Fastify from "fastify";
import prismaPlugin from "./plugins/prisma.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";

export async function buildServer(
  opts: {
    withPrisma?: boolean;
  } = {},
) {
  const fastify = Fastify({ logger: true });

  if (opts.withPrisma !== false) {
    await fastify.register(prismaPlugin);
    await fastify.register(authRoutes);
  }

  await fastify.register(healthRoutes);

  return fastify;
}

async function main() {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set — refusing to start");
    process.exit(1);
  }

  const server = await buildServer();
  const port = Number(process.env.PORT ?? 8000);

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
