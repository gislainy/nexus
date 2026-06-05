import { describe, it, expect } from "vitest";
import type { ProjectContext, ProjectListItem } from "@nexus/types";
import {
  createProjectService,
  type ProjectService,
} from "../../src/services/project.service.js";
import type {
  CreateProjectInput,
  ProjectRepository,
} from "../../src/repositories/project.repository.js";

interface FakeOptions {
  activeDomainConfigId?: string | null;
  context?: ProjectContext | null;
  projectsByUser?: ProjectListItem[];
}

function makeService(opts: FakeOptions = {}): {
  service: ProjectService;
  calls: { create: CreateProjectInput[] };
} {
  const calls = { create: [] as CreateProjectInput[] };
  const repository: ProjectRepository = {
    async create(input) {
      calls.create.push(input);
      return {
        projectId: "11111111-1111-1111-1111-111111111111",
        sessionId: "22222222-2222-2222-2222-222222222222",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };
    },
    async findContextById() {
      return opts.context ?? null;
    },
    async findByUserId() {
      return opts.projectsByUser ?? [];
    },
    async findActiveDomainConfigId() {
      return opts.activeDomainConfigId ?? null;
    },
    async existsById() {
      return false;
    },
  };
  return { service: createProjectService(repository), calls };
}

describe("ProjectService", () => {
  it("createProject with explicit domainConfigId returns result", async () => {
    const { service, calls } = makeService();
    const result = await service.createProject({
      name: "Demo",
      description: "A demo project",
      domainConfigId: "33333333-3333-3333-3333-333333333333",
    });
    expect(result.projectId).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.sessionId).toBe("22222222-2222-2222-2222-222222222222");
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(calls.create[0]?.domainConfigId).toBe(
      "33333333-3333-3333-3333-333333333333",
    );
  });

  it("createProject without domainConfigId uses the active domain", async () => {
    const { service, calls } = makeService({
      activeDomainConfigId: "44444444-4444-4444-4444-444444444444",
    });
    await service.createProject({ name: "Demo", description: "x" });
    expect(calls.create[0]?.domainConfigId).toBe(
      "44444444-4444-4444-4444-444444444444",
    );
  });

  it("createProject throws when no active domain configuration exists", async () => {
    const { service } = makeService({ activeDomainConfigId: null });
    await expect(
      service.createProject({ name: "Demo", description: "x" }),
    ).rejects.toThrow("No active domain configuration found");
  });

  it("getProjectContext returns the context for an existing project", async () => {
    const context: ProjectContext = {
      projectId: "55555555-5555-5555-5555-555555555555",
      description: "ctx",
      collaborators: [],
    };
    const { service } = makeService({ context });
    await expect(
      service.getProjectContext(context.projectId),
    ).resolves.toEqual(context);
  });

  it("getProjectContext throws for a missing project", async () => {
    const { service } = makeService({ context: null });
    await expect(
      service.getProjectContext("66666666-6666-6666-6666-666666666666"),
    ).rejects.toThrow("Project not found");
  });

  it("listProjects returns the user's projects wrapped in { projects }", async () => {
    const projectsByUser: ProjectListItem[] = [
      {
        projectId: "77777777-7777-7777-7777-777777777777",
        name: "Owned Project",
        sessionStatus: "IN_PROGRESS",
        userRole: "OWNER",
      },
    ];
    const { service } = makeService({ projectsByUser });
    await expect(
      service.listProjects("88888888-8888-8888-8888-888888888888"),
    ).resolves.toEqual({ projects: projectsByUser });
  });

  it("listProjects returns an empty list when the user has no projects", async () => {
    const { service } = makeService({ projectsByUser: [] });
    await expect(
      service.listProjects("99999999-9999-9999-9999-999999999999"),
    ).resolves.toEqual({ projects: [] });
  });
});
