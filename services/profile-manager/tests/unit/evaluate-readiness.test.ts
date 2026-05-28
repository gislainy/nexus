import { describe, it, expect } from "vitest";
import type { SessionStatus } from "@nexus/types";
import { createCollaboratorService } from "../../src/services/collaborator.service.js";
import type { CollaboratorRepository } from "../../src/repositories/collaborator.repository.js";
import type { ProjectRepository } from "../../src/repositories/project.repository.js";
import type { SessionRepository } from "../../src/repositories/session.repository.js";

function makeService(opts: { status: SessionStatus; pending: number }) {
  const calls = { updated: [] as SessionStatus[] };
  const collaboratorRepository = {} as CollaboratorRepository;
  const projectRepository = {} as ProjectRepository;
  const sessionRepository: SessionRepository = {
    async findStatusById() {
      return opts.status;
    },
    async updateStatus(_sessionId, status) {
      calls.updated.push(status);
    },
    async countPendingDelegations() {
      return opts.pending;
    },
  };
  const service = createCollaboratorService(
    collaboratorRepository,
    projectRepository,
    sessionRepository,
  );
  return { service, calls };
}

describe("evaluateReadiness", () => {
  it("IN_PROGRESS does not change status", async () => {
    const { service, calls } = makeService({
      status: "IN_PROGRESS",
      pending: 0,
    });
    const result = await service.evaluateReadiness("s1");
    expect(result).toBe("IN_PROGRESS");
    expect(calls.updated).toHaveLength(0);
  });

  it("SUFFICIENT with no pending delegations advances to READY_FOR_ARGUMENTATION", async () => {
    const { service, calls } = makeService({ status: "SUFFICIENT", pending: 0 });
    const result = await service.evaluateReadiness("s1");
    expect(result).toBe("READY_FOR_ARGUMENTATION");
    expect(calls.updated).toEqual(["READY_FOR_ARGUMENTATION"]);
  });

  it("SUFFICIENT with a pending delegation advances to AWAITING_DELEGATION", async () => {
    const { service, calls } = makeService({ status: "SUFFICIENT", pending: 1 });
    const result = await service.evaluateReadiness("s1");
    expect(result).toBe("AWAITING_DELEGATION");
    expect(calls.updated).toEqual(["AWAITING_DELEGATION"]);
  });

  it("AWAITING_DELEGATION with no pending delegations advances to READY_FOR_ARGUMENTATION", async () => {
    const { service, calls } = makeService({
      status: "AWAITING_DELEGATION",
      pending: 0,
    });
    const result = await service.evaluateReadiness("s1");
    expect(result).toBe("READY_FOR_ARGUMENTATION");
    expect(calls.updated).toEqual(["READY_FOR_ARGUMENTATION"]);
  });

  it("READY_FOR_ARGUMENTATION does not change status", async () => {
    const { service, calls } = makeService({
      status: "READY_FOR_ARGUMENTATION",
      pending: 0,
    });
    const result = await service.evaluateReadiness("s1");
    expect(result).toBe("READY_FOR_ARGUMENTATION");
    expect(calls.updated).toHaveLength(0);
  });
});
