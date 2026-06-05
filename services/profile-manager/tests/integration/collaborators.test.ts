import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../src/index.js";
import { bearer } from "../helpers/auth.js";

const DOMAIN_CONFIG_ID = "00000000-0000-0000-0000-00000000aaaa";

async function createProject(server: FastifyInstance): Promise<string> {
  const res = await server.inject({
    method: "POST",
    url: "/projects",
    headers: bearer(),
    payload: {
      name: "Collaborator Project",
      description: "Holds collaborators",
      domainConfigId: DOMAIN_CONFIG_ID,
    },
  });
  return res.json().projectId as string;
}

async function addCollaborator(
  server: FastifyInstance,
  projectId: string,
): Promise<string> {
  const res = await server.inject({
    method: "POST",
    url: `/projects/${projectId}/collaborators`,
    payload: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      suggestedProfile: "ARCHITECT",
    },
  });
  return res.json().collaboratorId as string;
}

describe("profile-manager collaborators (integration)", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ withPrisma: true });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it("POST collaborators with a valid body returns 201", async () => {
    const projectId = await createProject(server);
    const res = await server.inject({
      method: "POST",
      url: `/projects/${projectId}/collaborators`,
      payload: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        suggestedProfile: "DEVELOPER",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.collaboratorId).toBeTypeOf("string");
    expect(body.profileType).toBe("DEVELOPER");
    expect(body.createdAt).toBeTypeOf("string");
  });

  it("POST collaborators with an invalid body (no name) returns 400", async () => {
    const projectId = await createProject(server);
    const res = await server.inject({
      method: "POST",
      url: `/projects/${projectId}/collaborators`,
      payload: { email: "ada@example.com", suggestedProfile: "DEVELOPER" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST collaborators with a missing project returns 404", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/projects/77777777-7777-7777-7777-777777777777/collaborators",
      payload: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        suggestedProfile: "DEVELOPER",
      },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "Project not found" });
  });

  it("GET profile returns a single-event history for a DECLARATIVE profile", async () => {
    const projectId = await createProject(server);
    const collaboratorId = await addCollaborator(server, projectId);
    const res = await server.inject({
      method: "GET",
      url: `/projects/${projectId}/collaborators/${collaboratorId}/profile`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.identificationMethod).toBe("DECLARATIVE");
    expect(body.confidence).toBe(0.7);
    expect(body.history).toHaveLength(1);
    expect(body.history[0].type).toBe("INITIAL_DECLARATION");
  });

  it("GET profile after a PATCH returns a two-event history with confidence 1.0", async () => {
    const projectId = await createProject(server);
    const collaboratorId = await addCollaborator(server, projectId);
    await server.inject({
      method: "PATCH",
      url: `/projects/${projectId}/collaborators/${collaboratorId}/profile`,
      payload: { profileType: "REGULATORY" },
    });
    const res = await server.inject({
      method: "GET",
      url: `/projects/${projectId}/collaborators/${collaboratorId}/profile`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.identificationMethod).toBe("OWNER_REVISION");
    expect(body.confidence).toBe(1.0);
    expect(body.profileType).toBe("REGULATORY");
    expect(body.history).toHaveLength(2);
    expect(body.history[1].type).toBe("EXPLICIT_REVISION");
  });

  it("GET profile with a missing collaborator returns 404", async () => {
    const projectId = await createProject(server);
    const res = await server.inject({
      method: "GET",
      url: `/projects/${projectId}/collaborators/88888888-8888-8888-8888-888888888888/profile`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "Collaborator not found" });
  });

  it("PATCH profile with a valid body returns 200 with the updated profile", async () => {
    const projectId = await createProject(server);
    const collaboratorId = await addCollaborator(server, projectId);
    const res = await server.inject({
      method: "PATCH",
      url: `/projects/${projectId}/collaborators/${collaboratorId}/profile`,
      payload: { profileType: "MANAGER" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.profileType).toBe("MANAGER");
    expect(body.confidence).toBe(1.0);
    expect(body.identificationMethod).toBe("OWNER_REVISION");
  });

  it("PATCH profile with a missing collaborator returns 404", async () => {
    const projectId = await createProject(server);
    const res = await server.inject({
      method: "PATCH",
      url: `/projects/${projectId}/collaborators/99999999-9999-9999-9999-999999999999/profile`,
      payload: { profileType: "MANAGER" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "Collaborator not found" });
  });
});
