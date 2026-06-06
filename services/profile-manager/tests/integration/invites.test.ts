import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../src/index.js";
import { realAccessToken } from "../helpers/auth.js";

const DOMAIN_CONFIG_ID = "00000000-0000-0000-0000-00000000aaaa";

function auth(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

async function createProject(
  server: FastifyInstance,
  token: string,
): Promise<string> {
  const res = await server.inject({
    method: "POST",
    url: "/projects",
    headers: auth(token),
    payload: {
      name: "Invite Project",
      description: "Holds invites",
      domainConfigId: DOMAIN_CONFIG_ID,
    },
  });
  return res.json().projectId as string;
}

async function createInvite(
  server: FastifyInstance,
  token: string,
  projectId: string,
  inviteeEmail: string,
  suggestedProfile = "DEVELOPER",
): Promise<string> {
  const res = await server.inject({
    method: "POST",
    url: `/projects/${projectId}/invites`,
    headers: auth(token),
    payload: { inviteeEmail, suggestedProfile },
  });
  return res.json().token as string;
}

describe("profile-manager invites (integration)", () => {
  let server: FastifyInstance;
  let ownerToken: string;

  beforeAll(async () => {
    server = await buildServer({ withPrisma: true });
    await server.ready();
    ownerToken = await realAccessToken("invite-owner@example.com", "Invite Owner");
  });

  afterAll(async () => {
    await server.close();
  });

  it("POST invites with auth returns 201 with inviteId and token", async () => {
    const projectId = await createProject(server, ownerToken);
    const res = await server.inject({
      method: "POST",
      url: `/projects/${projectId}/invites`,
      headers: auth(ownerToken),
      payload: {
        inviteeEmail: "fresh-guest@example.com",
        suggestedProfile: "DEVELOPER",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.inviteId).toBeTypeOf("string");
    expect(body.token).toBeTypeOf("string");
  });

  it("POST invites without auth returns 401", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/projects/77777777-7777-7777-7777-777777777777/invites",
      payload: {
        inviteeEmail: "fresh-guest@example.com",
        suggestedProfile: "DEVELOPER",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /invites/:token with a valid token returns 200 with InviteDetails", async () => {
    const projectId = await createProject(server, ownerToken);
    const token = await createInvite(
      server,
      ownerToken,
      projectId,
      "lookup-guest@example.com",
      "ARCHITECT",
    );
    const res = await server.inject({
      method: "GET",
      url: `/invites/${token}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.projectId).toBe(projectId);
    expect(body.inviteeEmail).toBe("lookup-guest@example.com");
    expect(body.suggestedProfile).toBe("ARCHITECT");
    expect(body.status).toBe("PENDING");
    expect(body.isNewUser).toBeTypeOf("boolean");
  });

  it("GET /invites/:token with an invalid token returns 404", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/invites/not-a-real-token",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "Invite not found or expired" });
  });

  it("POST accept with an existing User creates a Collaborator linked by userId", async () => {
    const inviteeEmail = "invite-accepter@example.com";
    await realAccessToken(inviteeEmail, "Accepter");
    const projectId = await createProject(server, ownerToken);
    const token = await createInvite(server, ownerToken, projectId, inviteeEmail);

    const res = await server.inject({
      method: "POST",
      url: `/invites/${token}/accept`,
      payload: { confirmedProfile: "ARCHITECT" },
    });
    expect(res.statusCode).toBe(201);
    const collaboratorId = res.json().collaboratorId as string;
    expect(collaboratorId).toBeTypeOf("string");

    const user = await server.prisma.user.findUnique({
      where: { email: inviteeEmail },
    });
    const collaborator = await server.prisma.collaborator.findUnique({
      where: { id: collaboratorId },
    });
    expect(collaborator?.userId).toBe(user?.id);
  });

  it("POST accept without a registered User returns 422", async () => {
    const projectId = await createProject(server, ownerToken);
    const token = await createInvite(
      server,
      ownerToken,
      projectId,
      "never-registered@example.com",
    );
    const res = await server.inject({
      method: "POST",
      url: `/invites/${token}/accept`,
      payload: { confirmedProfile: "DEVELOPER" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({
      error: "User not found for invite email",
    });
  });

  it("POST decline returns 200 with DECLINED status", async () => {
    const projectId = await createProject(server, ownerToken);
    const token = await createInvite(
      server,
      ownerToken,
      projectId,
      "decline-guest@example.com",
    );
    const res = await server.inject({
      method: "POST",
      url: `/invites/${token}/decline`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "DECLINED" });
  });
});
