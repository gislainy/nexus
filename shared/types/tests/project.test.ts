import { describe, expect, it } from "vitest";
import {
  Collaborator,
  Profile,
  Project,
  Session,
  SessionContext,
} from "../src/project.js";

const UUID = "00000000-0000-0000-0000-000000000010";
const UUID2 = "00000000-0000-0000-0000-000000000011";

describe("Project / Collaborator / Profile / Session", () => {
  it("accepts a valid project", () => {
    const ok = Project.safeParse({
      id: UUID,
      name: "P",
      description: "",
      domainConfigId: UUID2,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an invalid project status", () => {
    const bad = Project.safeParse({
      id: UUID,
      name: "P",
      description: "",
      domainConfigId: UUID2,
      status: "FROZEN",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(bad.success).toBe(false);
  });

  it("rejects a collaborator with invalid email", () => {
    const bad = Collaborator.safeParse({
      id: UUID,
      projectId: UUID2,
      name: "N",
      email: "not-an-email",
      profileId: UUID,
      joinedAt: new Date(),
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a valid profile", () => {
    const ok = Profile.safeParse({
      id: UUID,
      type: "MANAGER",
      confidence: 0.7,
      identificationMethod: "DECLARATIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(ok.success).toBe(true);
  });

  it("rejects profile confidence above 1", () => {
    const bad = Profile.safeParse({
      id: UUID,
      type: "MANAGER",
      confidence: 1.5,
      identificationMethod: "DECLARATIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a session with snapshot", () => {
    const ok = Session.safeParse({
      id: UUID,
      projectId: UUID2,
      status: "IN_PROGRESS",
      xstateSnapshot: { value: "x" },
      startedAt: new Date(),
    });
    expect(ok.success).toBe(true);
  });

  it("validates SessionContext shape", () => {
    expect(
      SessionContext.safeParse({
        projectId: UUID,
        sessionId: UUID2,
        collaboratorId: UUID,
        profileType: "DEVELOPER",
        singleCollaborator: true,
        locale: "pt",
      }).success,
    ).toBe(true);
    expect(
      SessionContext.safeParse({
        projectId: UUID,
        sessionId: UUID2,
        collaboratorId: UUID,
        profileType: "DEVELOPER",
        singleCollaborator: true,
        locale: "fr",
      }).success,
    ).toBe(false);
  });
});
