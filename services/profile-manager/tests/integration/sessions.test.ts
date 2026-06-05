import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { SessionStatus } from "@nexus/types";
import { buildServer } from "../../src/index.js";
import { bearer } from "../helpers/auth.js";

const DOMAIN_CONFIG_ID = "00000000-0000-0000-0000-00000000aaaa";

async function createSession(
  server: FastifyInstance,
  status: SessionStatus,
): Promise<{ projectId: string; sessionId: string; collaboratorId: string }> {
  const projectRes = await server.inject({
    method: "POST",
    url: "/projects",
    headers: bearer(),
    payload: {
      name: "Session Project",
      description: "Holds a session",
      domainConfigId: DOMAIN_CONFIG_ID,
    },
  });
  const { projectId, sessionId } = projectRes.json();

  const collaboratorRes = await server.inject({
    method: "POST",
    url: `/projects/${projectId}/collaborators`,
    payload: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      suggestedProfile: "ARCHITECT",
    },
  });
  const { collaboratorId } = collaboratorRes.json();

  await server.prisma.session.update({
    where: { id: sessionId },
    data: { status },
  });

  return { projectId, sessionId, collaboratorId };
}

async function addDelegatedAnswer(
  server: FastifyInstance,
  sessionId: string,
  collaboratorId: string,
): Promise<void> {
  const instance = await server.prisma.questionInstance.create({
    data: {
      sessionId,
      textShown: "Is this delegated?",
      dimension: "TECHNICAL_JUSTIFICATION",
      inputType: "BOOLEAN",
      order: 1,
    },
  });
  await server.prisma.answer.create({
    data: {
      sessionId,
      questionInstanceId: instance.id,
      collaboratorId,
      value: "",
      confidence: "DELEGATED",
      epistemicConfidence: 0,
      source: "MANUAL",
    },
  });
}

async function addConfidentAnswer(
  server: FastifyInstance,
  sessionId: string,
  collaboratorId: string,
  value: string,
): Promise<string> {
  const instance = await server.prisma.questionInstance.create({
    data: {
      sessionId,
      textShown: "Is on-chain storage required?",
      dimension: "TECHNICAL_JUSTIFICATION",
      inputType: "BOOLEAN",
      order: 1,
    },
  });
  await server.prisma.answer.create({
    data: {
      sessionId,
      questionInstanceId: instance.id,
      collaboratorId,
      value,
      confidence: "CERTAIN",
      epistemicConfidence: 0.9,
      source: "MANUAL",
    },
  });
  return instance.id;
}

describe("profile-manager sessions (integration)", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ withPrisma: true });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it("complete on a SUFFICIENT session with no delegations returns READY_FOR_ARGUMENTATION", async () => {
    const { sessionId, collaboratorId } = await createSession(
      server,
      "SUFFICIENT",
    );
    const res = await server.inject({
      method: "POST",
      url: `/sessions/${sessionId}/collaborators/${collaboratorId}/complete`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      sessionStatus: "READY_FOR_ARGUMENTATION",
    });
  });

  it("complete on a SUFFICIENT session with a pending delegation returns AWAITING_DELEGATION", async () => {
    const { sessionId, collaboratorId } = await createSession(
      server,
      "SUFFICIENT",
    );
    await addDelegatedAnswer(server, sessionId, collaboratorId);
    const res = await server.inject({
      method: "POST",
      url: `/sessions/${sessionId}/collaborators/${collaboratorId}/complete`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ sessionStatus: "AWAITING_DELEGATION" });
  });

  it("complete on an IN_PROGRESS session leaves the status unchanged", async () => {
    const { sessionId, collaboratorId } = await createSession(
      server,
      "IN_PROGRESS",
    );
    const res = await server.inject({
      method: "POST",
      url: `/sessions/${sessionId}/collaborators/${collaboratorId}/complete`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ sessionStatus: "IN_PROGRESS" });
  });

  it("complete on a missing session returns 404", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/sessions/77777777-7777-7777-7777-777777777777/collaborators/88888888-8888-8888-8888-888888888888/complete",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "Session not found" });
  });

  it("force-advance on an AWAITING_DELEGATION session returns READY_FOR_ARGUMENTATION", async () => {
    const { sessionId } = await createSession(server, "AWAITING_DELEGATION");
    const res = await server.inject({
      method: "POST",
      url: `/sessions/${sessionId}/force-advance`,
      payload: { reason: "Owner accepts the existing gaps" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      sessionStatus: "READY_FOR_ARGUMENTATION",
    });
  });

  it("force-advance on an IN_PROGRESS session returns 400", async () => {
    const { sessionId } = await createSession(server, "IN_PROGRESS");
    const res = await server.inject({
      method: "POST",
      url: `/sessions/${sessionId}/force-advance`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: "Session is not in AWAITING_DELEGATION status",
    });
  });

  it("force-advance on a missing session returns 404", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/sessions/77777777-7777-7777-7777-777777777777/force-advance",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "Session not found" });
  });

  it("status returns sessionId, status, and pendingDelegations", async () => {
    const { sessionId, collaboratorId } = await createSession(
      server,
      "AWAITING_DELEGATION",
    );
    await addDelegatedAnswer(server, sessionId, collaboratorId);
    const res = await server.inject({
      method: "GET",
      url: `/sessions/${sessionId}/status`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      sessionId,
      status: "AWAITING_DELEGATION",
      pendingDelegations: 1,
    });
  });

  it("status on a missing session returns 404", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/sessions/77777777-7777-7777-7777-777777777777/status",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "Session not found" });
  });

  it("check-conflict returns hasConflict true for a contradictory BOOLEAN answer", async () => {
    const { sessionId, collaboratorId } = await createSession(
      server,
      "IN_PROGRESS",
    );
    const questionInstanceId = await addConfidentAnswer(
      server,
      sessionId,
      collaboratorId,
      "true",
    );
    const res = await server.inject({
      method: "POST",
      url: `/sessions/${sessionId}/answers/check-conflict`,
      payload: {
        questionInstanceId,
        newAnswer: {
          value: "false",
          inputType: "BOOLEAN",
          collaboratorId: "99999999-9999-9999-9999-999999999999",
          epistemicConfidence: 0.9,
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ hasConflict: true });
    expect(res.json().conflictingAnswerId).toBeTruthy();
  });

  it("check-conflict returns hasConflict false when there is no prior answer", async () => {
    const { sessionId } = await createSession(server, "IN_PROGRESS");
    const res = await server.inject({
      method: "POST",
      url: `/sessions/${sessionId}/answers/check-conflict`,
      payload: {
        questionInstanceId: "11111111-1111-1111-1111-111111111111",
        newAnswer: {
          value: "true",
          inputType: "BOOLEAN",
          collaboratorId: "99999999-9999-9999-9999-999999999999",
          epistemicConfidence: 0.9,
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ hasConflict: false });
  });
});
