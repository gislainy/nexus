import { describe, it, expect } from "vitest";
import type { CollaboratorProfile, ProfileType } from "@nexus/types";
import {
  createCollaboratorService,
  type CollaboratorService,
} from "../../src/services/collaborator.service.js";
import type {
  CollaboratorRepository,
  CreateCollaboratorInput,
} from "../../src/repositories/collaborator.repository.js";
import type { ProjectRepository } from "../../src/repositories/project.repository.js";

interface FakeOptions {
  projectExists?: boolean;
  profile?: CollaboratorProfile | null;
}

function declarativeProfile(profileType: ProfileType): CollaboratorProfile {
  return {
    collaboratorId: "11111111-1111-1111-1111-111111111111",
    profileType,
    confidence: 0.7,
    identificationMethod: "DECLARATIVE",
    history: [
      {
        type: "INITIAL_DECLARATION",
        profileType,
        confidence: 0.7,
        identificationMethod: "DECLARATIVE",
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

function revisedProfile(profileType: ProfileType): CollaboratorProfile {
  return {
    collaboratorId: "11111111-1111-1111-1111-111111111111",
    profileType,
    confidence: 1.0,
    identificationMethod: "OWNER_REVISION",
    history: [
      {
        type: "INITIAL_DECLARATION",
        profileType,
        confidence: 1.0,
        identificationMethod: "OWNER_REVISION",
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
      {
        type: "EXPLICIT_REVISION",
        profileType,
        confidence: 1.0,
        identificationMethod: "OWNER_REVISION",
        occurredAt: "2026-01-02T00:00:00.000Z",
      },
    ],
  };
}

function makeService(opts: FakeOptions = {}): {
  service: CollaboratorService;
  calls: { create: CreateCollaboratorInput[] };
} {
  const calls = { create: [] as CreateCollaboratorInput[] };
  const collaboratorRepository: CollaboratorRepository = {
    async create(input) {
      calls.create.push(input);
      return {
        collaboratorId: "11111111-1111-1111-1111-111111111111",
        profileType: input.profileType,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };
    },
    async findProfileByCollaboratorId() {
      return opts.profile ?? null;
    },
    async updateProfile(_projectId, _collaboratorId, profileType) {
      return revisedProfile(profileType);
    },
  };
  const projectRepository: ProjectRepository = {
    async create() {
      throw new Error("not used");
    },
    async findContextById() {
      return null;
    },
    async findActiveDomainConfigId() {
      return null;
    },
    async existsById() {
      return opts.projectExists ?? true;
    },
  };
  return {
    service: createCollaboratorService(
      collaboratorRepository,
      projectRepository,
    ),
    calls,
  };
}

describe("CollaboratorService", () => {
  it("inviteCollaborator with an existing project returns the result", async () => {
    const { service, calls } = makeService({ projectExists: true });
    const result = await service.inviteCollaborator({
      projectId: "p1",
      name: "Ada",
      email: "ada@example.com",
      suggestedProfile: "ARCHITECT",
    });
    expect(result.collaboratorId).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.profileType).toBe("ARCHITECT");
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(calls.create[0]?.profileType).toBe("ARCHITECT");
  });

  it("inviteCollaborator with a missing project throws", async () => {
    const { service } = makeService({ projectExists: false });
    await expect(
      service.inviteCollaborator({
        projectId: "p1",
        name: "Ada",
        email: "ada@example.com",
        suggestedProfile: "ARCHITECT",
      }),
    ).rejects.toThrow("Project not found");
  });

  it("getProfile returns a single-event history for a DECLARATIVE profile", async () => {
    const { service } = makeService({ profile: declarativeProfile("DEVELOPER") });
    const profile = await service.getProfile("p1", "c1");
    expect(profile.history).toHaveLength(1);
    expect(profile.history[0]?.type).toBe("INITIAL_DECLARATION");
  });

  it("getProfile returns a two-event history for an OWNER_REVISION profile", async () => {
    const { service } = makeService({ profile: revisedProfile("DEVELOPER") });
    const profile = await service.getProfile("p1", "c1");
    expect(profile.history).toHaveLength(2);
    expect(profile.history[1]?.type).toBe("EXPLICIT_REVISION");
  });

  it("getProfile with a missing collaborator throws", async () => {
    const { service } = makeService({ profile: null });
    await expect(service.getProfile("p1", "c1")).rejects.toThrow(
      "Collaborator not found",
    );
  });

  it("patchProfile returns confidence 1.0 and OWNER_REVISION", async () => {
    const { service } = makeService();
    const profile = await service.patchProfile({
      projectId: "p1",
      collaboratorId: "c1",
      profileType: "REGULATORY",
    });
    expect(profile.confidence).toBe(1.0);
    expect(profile.identificationMethod).toBe("OWNER_REVISION");
    expect(profile.profileType).toBe("REGULATORY");
  });
});
