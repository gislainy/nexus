import type { ProjectContext, ProjectListResponse } from "@nexus/types";
import type { ProjectRepository } from "../repositories/project.repository.js";

export interface CreateProjectPayload {
  name: string;
  description: string;
  domainConfigId?: string;
}

export interface CreateProjectResult {
  projectId: string;
  sessionId: string;
  createdAt: Date;
}

export interface ProjectService {
  createProject(payload: CreateProjectPayload): Promise<CreateProjectResult>;
  getProjectContext(projectId: string): Promise<ProjectContext>;
  listProjects(userId: string): Promise<ProjectListResponse>;
}

export function createProjectService(
  repository: ProjectRepository,
): ProjectService {
  return {
    async createProject(payload) {
      let domainConfigId = payload.domainConfigId;
      if (!domainConfigId) {
        const activeId = await repository.findActiveDomainConfigId();
        if (!activeId) {
          throw new Error("No active domain configuration found");
        }
        domainConfigId = activeId;
      }
      return repository.create({
        name: payload.name,
        description: payload.description,
        domainConfigId,
      });
    },

    async getProjectContext(projectId) {
      const context = await repository.findContextById(projectId);
      if (!context) {
        throw new Error("Project not found");
      }
      return context;
    },

    async listProjects(userId) {
      const projects = await repository.findByUserId(userId);
      return { projects };
    },
  };
}
