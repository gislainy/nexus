import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../src/index.js";

describe("profile-manager projects (integration)", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ withPrisma: true });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it("POST /projects with a valid body returns 201", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/projects",
      payload: {
        name: "Integration Project",
        description: "Created from the integration suite",
        domainConfigId: "00000000-0000-0000-0000-00000000aaaa",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.projectId).toBeTypeOf("string");
    expect(body.sessionId).toBeTypeOf("string");
    expect(body.createdAt).toBeTypeOf("string");
  });

  it("POST /projects with an invalid body returns 400", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/projects",
      payload: { description: "missing name" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /projects without domainConfigId uses the active domain", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/projects",
      payload: {
        name: "Active Domain Project",
        description: "Resolves the active domain config",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().projectId).toBeTypeOf("string");
  });

  it("GET /projects/:projectId/context returns 200 for an existing project", async () => {
    const created = await server.inject({
      method: "POST",
      url: "/projects",
      payload: {
        name: "Context Project",
        description: "Has a retrievable context",
        domainConfigId: "00000000-0000-0000-0000-00000000aaaa",
      },
    });
    const { projectId } = created.json();

    const res = await server.inject({
      method: "GET",
      url: `/projects/${projectId}/context`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.projectId).toBe(projectId);
    expect(body.collaborators).toEqual([]);
  });

  it("GET /projects/:projectId/context returns 404 for a missing project", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/projects/77777777-7777-7777-7777-777777777777/context",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "Project not found" });
  });
});
