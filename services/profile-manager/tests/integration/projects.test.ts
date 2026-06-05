import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../src/index.js";
import { bearer } from "../helpers/auth.js";

const DOMAIN_CONFIG_ID = "00000000-0000-0000-0000-00000000aaaa";

describe("profile-manager projects (integration)", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ withPrisma: true });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it("POST /projects without a token returns 401", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/projects",
      payload: {
        name: "Unauthorized Project",
        description: "Should be rejected",
        domainConfigId: DOMAIN_CONFIG_ID,
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /projects with a valid body and token returns 201", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/projects",
      headers: bearer(),
      payload: {
        name: "Integration Project",
        description: "Created from the integration suite",
        domainConfigId: DOMAIN_CONFIG_ID,
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
      headers: bearer(),
      payload: { description: "missing name" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /projects without domainConfigId uses the active domain", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/projects",
      headers: bearer(),
      payload: {
        name: "Active Domain Project",
        description: "Resolves the active domain config",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().projectId).toBeTypeOf("string");
  });

  it("GET /projects without a token returns 401", async () => {
    const res = await server.inject({ method: "GET", url: "/projects" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /projects with a token returns 200 with a list", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/projects",
      headers: bearer(),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().projects)).toBe(true);
  });

  it("GET /projects returns a project created by the authenticated user as OWNER", async () => {
    const userId = "20000000-0000-0000-0000-000000000002";
    const email = "owner@example.com";

    // The creator must exist in the user table so findByUserId can resolve the
    // email that links them to the collaborator created at project creation.
    await server.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email, name: "Owner", passwordHash: "x" },
    });

    const created = await server.inject({
      method: "POST",
      url: "/projects",
      headers: bearer(userId, email),
      payload: {
        name: "Owned Project",
        description: "Owned by the test user",
        domainConfigId: DOMAIN_CONFIG_ID,
      },
    });
    expect(created.statusCode).toBe(201);
    const { projectId } = created.json();

    const res = await server.inject({
      method: "GET",
      url: "/projects",
      headers: bearer(userId, email),
    });
    expect(res.statusCode).toBe(200);
    const projects = res.json().projects as Array<{
      projectId: string;
      name: string;
      sessionStatus: string;
      userRole: string;
    }>;
    const found = projects.find((p) => p.projectId === projectId);
    expect(found).toBeDefined();
    expect(found?.name).toBe("Owned Project");
    expect(found?.userRole).toBe("OWNER");
    expect(found?.sessionStatus).toBe("IN_PROGRESS");
  });

  it("GET /projects/:projectId/context without a token returns 401", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/projects/77777777-7777-7777-7777-777777777777/context",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /projects/:projectId/context returns 200 for an existing project", async () => {
    const created = await server.inject({
      method: "POST",
      url: "/projects",
      headers: bearer(),
      payload: {
        name: "Context Project",
        description: "Has a retrievable context",
        domainConfigId: DOMAIN_CONFIG_ID,
      },
    });
    const { projectId } = created.json();

    const res = await server.inject({
      method: "GET",
      url: `/projects/${projectId}/context`,
      headers: bearer(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.projectId).toBe(projectId);
    // The creator is registered as the project's first collaborator (owner).
    expect(body.collaborators).toHaveLength(1);
    expect(body.collaborators[0].profileType).toBe("MANAGER");
  });

  it("GET /projects/:projectId/context returns 404 for a missing project", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/projects/77777777-7777-7777-7777-777777777777/context",
      headers: bearer(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "Project not found" });
  });
});
