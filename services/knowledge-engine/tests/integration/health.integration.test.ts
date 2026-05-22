import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../src/index.js";

describe("knowledge-engine routes (integration)", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ withPrisma: false });
  });

  afterAll(async () => {
    await server.close();
  });

  it("GET /health returns 200", async () => {
    const res = await server.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });
});
