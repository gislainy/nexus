import { describe, it, expect } from "vitest";
import type { SessionStatus } from "@nexus/types";
import { detectConflict } from "../../src/services/conflict.service.js";
import type { NewAnswer } from "../../src/services/conflict.service.js";
import type { ConfidentAnswer } from "../../src/repositories/answer.repository.js";
import { createCollaboratorService } from "../../src/services/collaborator.service.js";
import type { CollaboratorRepository } from "../../src/repositories/collaborator.repository.js";
import type { ProjectRepository } from "../../src/repositories/project.repository.js";
import type { SessionRepository } from "../../src/repositories/session.repository.js";

function makeService(status: SessionStatus | null) {
  const calls = { advanced: [] as string[] };
  const collaboratorRepository = {} as CollaboratorRepository;
  const projectRepository = {} as ProjectRepository;
  const sessionRepository: SessionRepository = {
    async findStatusById() {
      return status;
    },
    async updateStatus() {},
    async countPendingDelegations() {
      return 0;
    },
    async forceAdvance(sessionId) {
      calls.advanced.push(sessionId);
      return "READY_FOR_ARGUMENTATION";
    },
    async findStatusWithPendingDelegations() {
      return status ? { status, pendingDelegations: 0 } : null;
    },
  };
  const service = createCollaboratorService(
    collaboratorRepository,
    projectRepository,
    sessionRepository,
  );
  return { service, calls };
}

const newAnswer = (
  value: string,
  inputType: NewAnswer["inputType"],
): NewAnswer => ({
  value,
  inputType,
  collaboratorId: "c2",
  epistemicConfidence: 0.9,
});

const existing = (
  value: string,
  epistemicConfidence = 0.9,
): ConfidentAnswer => ({
  id: "a1",
  value,
  epistemicConfidence,
});

describe("forceAdvance", () => {
  it("advances a session in AWAITING_DELEGATION to READY_FOR_ARGUMENTATION", async () => {
    const { service, calls } = makeService("AWAITING_DELEGATION");
    const result = await service.forceAdvance("s1");
    expect(result).toBe("READY_FOR_ARGUMENTATION");
    expect(calls.advanced).toEqual(["s1"]);
  });

  it("throws when the session is in IN_PROGRESS", async () => {
    const { service, calls } = makeService("IN_PROGRESS");
    await expect(service.forceAdvance("s1")).rejects.toThrow(
      "Session is not in AWAITING_DELEGATION status",
    );
    expect(calls.advanced).toHaveLength(0);
  });

  it("throws when the session does not exist", async () => {
    const { service } = makeService(null);
    await expect(service.forceAdvance("s1")).rejects.toThrow(
      "Session not found",
    );
  });
});

describe("detectConflict", () => {
  it("reports no conflict for matching BOOLEAN values", () => {
    const result = detectConflict(newAnswer("true", "BOOLEAN"), [
      existing("true"),
    ]);
    expect(result.hasConflict).toBe(false);
  });

  it("reports a conflict for contradictory BOOLEAN values", () => {
    const result = detectConflict(newAnswer("true", "BOOLEAN"), [
      existing("false"),
    ]);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingAnswerId).toBe("a1");
  });

  it("reports a conflict for SCALE values that differ beyond the threshold", () => {
    const result = detectConflict(newAnswer("0.2", "SCALE"), [
      existing("0.7"),
    ]);
    expect(result.hasConflict).toBe(true);
  });

  it("reports no conflict for SCALE values within the threshold", () => {
    const result = detectConflict(newAnswer("0.5", "SCALE"), [
      existing("0.6"),
    ]);
    expect(result.hasConflict).toBe(false);
  });

  it("always reports a conflict for TEXT when another confident answer exists", () => {
    const result = detectConflict(newAnswer("some prose", "TEXT"), [
      existing("different prose"),
    ]);
    expect(result.hasConflict).toBe(true);
  });

  it("reports no conflict when there is no prior confident answer", () => {
    const result = detectConflict(newAnswer("true", "BOOLEAN"), []);
    expect(result.hasConflict).toBe(false);
  });
});
