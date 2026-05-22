import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../src/index.js";

describe("knowledge-engine routes (integration)", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it("GET /health returns 200", async () => {
    const res = await server.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });

  it("POST /retrieve returns 501", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/retrieve",
      payload: { queryText: "blockchain", topK: 5 },
    });
    expect(res.statusCode).toBe(501);
    expect(res.json()).toEqual({ error: "not_implemented" });
  });

  it("GET /chunks/:id returns 501", async () => {
    const res = await server.inject({ method: "GET", url: "/chunks/any-id" });
    expect(res.statusCode).toBe(501);
    expect(res.json()).toEqual({ error: "not_implemented" });
  });
});
