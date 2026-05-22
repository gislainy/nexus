import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { healthRoutes } from "../../src/routes/health.js";

describe("GET /health (unit)", () => {
  it("returns 200 and status ok", async () => {
    const fastify = Fastify();
    await fastify.register(healthRoutes);
    const res = await fastify.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", service: "knowledge-engine" });
    await fastify.close();
  });
});
