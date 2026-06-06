import { describe, it, expect } from "vitest";
import type { ProfileType } from "@nexus/types";
import {
  createInviteService,
  type InviteService,
} from "../../src/services/invite.service.js";
import type {
  InviteRecord,
  InviteRepository,
} from "../../src/repositories/invite.repository.js";
import type { UserRepository } from "../../src/repositories/user.repository.js";
import type { ProjectRepository } from "../../src/repositories/project.repository.js";

interface FakeOptions {
  projectExists?: boolean;
  isActiveCollaborator?: boolean;
  hasPendingInvite?: boolean;
  invite?: InviteRecord | null;
  user?: { id: string; name: string } | null;
}

interface Calls {
  create: number;
  markExpired: string[];
  markAccepted: string[];
  markDeclined: string[];
  createdCollaborator: Array<{
    projectId: string;
    userId: string;
    name: string;
    email: string;
    confirmedProfile: ProfileType;
  }>;
  logs: string[];
}

const PENDING_INVITE: InviteRecord = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  projectId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  projectName: "Health Project",
  invitedByName: "Owner Name",
  inviteeEmail: "guest@example.com",
  suggestedProfile: "ARCHITECT",
  status: "PENDING",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
};

function makeService(opts: FakeOptions = {}): {
  service: InviteService;
  calls: Calls;
} {
  const calls: Calls = {
    create: 0,
    markExpired: [],
    markAccepted: [],
    markDeclined: [],
    createdCollaborator: [],
    logs: [],
  };

  const inviteRepository: InviteRepository = {
    async isActiveCollaborator() {
      return opts.isActiveCollaborator ?? false;
    },
    async hasPendingInvite() {
      return opts.hasPendingInvite ?? false;
    },
    async create() {
      calls.create += 1;
      return { inviteId: PENDING_INVITE.id };
    },
    async findByToken() {
      return opts.invite ?? null;
    },
    async markExpired(inviteId) {
      calls.markExpired.push(inviteId);
    },
    async markAccepted(inviteId) {
      calls.markAccepted.push(inviteId);
    },
    async markDeclined(inviteId) {
      calls.markDeclined.push(inviteId);
    },
    async createCollaboratorFromInvite(input) {
      calls.createdCollaborator.push(input);
      return { collaboratorId: "cccccccc-cccc-cccc-cccc-cccccccccccc" };
    },
  };

  const userRepository: UserRepository = {
    async findByEmail() {
      return opts.user ?? null;
    },
  };

  const projectRepository: ProjectRepository = {
    async create() {
      throw new Error("not used");
    },
    async findContextById() {
      return null;
    },
    async findByUserId() {
      return [];
    },
    async findActiveDomainConfigId() {
      return null;
    },
    async existsById() {
      return opts.projectExists ?? true;
    },
  };

  const service = createInviteService(
    inviteRepository,
    userRepository,
    projectRepository,
    { info: (message) => calls.logs.push(message) },
  );
  return { service, calls };
}

const newInput = {
  inviteeEmail: "guest@example.com",
  suggestedProfile: "ARCHITECT" as ProfileType,
};

describe("InviteService", () => {
  it("createInvite with an existing project and new email returns inviteId and token", async () => {
    const { service, calls } = makeService({ projectExists: true });
    const result = await service.createInvite("p1", "u1", newInput);
    expect(result.inviteId).toBeTypeOf("string");
    expect(result.token).toBeTypeOf("string");
    expect(calls.create).toBe(1);
    expect(calls.logs[0]).toContain("/invites/");
  });

  it("createInvite with an already active collaborator throws", async () => {
    const { service } = makeService({ isActiveCollaborator: true });
    await expect(service.createInvite("p1", "u1", newInput)).rejects.toThrow(
      "Collaborator already active",
    );
  });

  it("createInvite with a pending invite throws", async () => {
    const { service } = makeService({ hasPendingInvite: true });
    await expect(service.createInvite("p1", "u1", newInput)).rejects.toThrow(
      "Invite already pending for this email",
    );
  });

  it("getInviteByToken with no matching User returns isNewUser true", async () => {
    const { service } = makeService({ invite: PENDING_INVITE, user: null });
    const details = await service.getInviteByToken("token");
    expect(details.isNewUser).toBe(true);
    expect(details.projectName).toBe("Health Project");
    expect(details.suggestedProfile).toBe("ARCHITECT");
  });

  it("getInviteByToken with a matching User returns isNewUser false", async () => {
    const { service } = makeService({
      invite: PENDING_INVITE,
      user: { id: "u9", name: "Existing" },
    });
    const details = await service.getInviteByToken("token");
    expect(details.isNewUser).toBe(false);
  });

  it("getInviteByToken with an expired token marks it expired and throws", async () => {
    const expired: InviteRecord = {
      ...PENDING_INVITE,
      expiresAt: new Date(Date.now() - 1000),
    };
    const { service, calls } = makeService({ invite: expired });
    await expect(service.getInviteByToken("token")).rejects.toThrow(
      "Invite not found or expired",
    );
    expect(calls.markExpired).toContain(expired.id);
  });

  it("acceptInvite with an existing User creates a Collaborator and returns its id", async () => {
    const { service, calls } = makeService({
      invite: PENDING_INVITE,
      user: { id: "u9", name: "Existing" },
    });
    const result = await service.acceptInvite("token", "DEVELOPER");
    expect(result.collaboratorId).toBe("cccccccc-cccc-cccc-cccc-cccccccccccc");
    expect(calls.createdCollaborator[0]).toMatchObject({
      userId: "u9",
      name: "Existing",
      email: "guest@example.com",
      confirmedProfile: "DEVELOPER",
    });
    expect(calls.markAccepted).toContain(PENDING_INVITE.id);
  });

  it("acceptInvite without a registered User throws", async () => {
    const { service, calls } = makeService({
      invite: PENDING_INVITE,
      user: null,
    });
    await expect(service.acceptInvite("token", "DEVELOPER")).rejects.toThrow(
      "User not found for invite email",
    );
    expect(calls.createdCollaborator).toHaveLength(0);
  });

  it("declineInvite updates the invite status to DECLINED", async () => {
    const { service, calls } = makeService({ invite: PENDING_INVITE });
    await service.declineInvite("token");
    expect(calls.markDeclined).toContain(PENDING_INVITE.id);
  });
});
