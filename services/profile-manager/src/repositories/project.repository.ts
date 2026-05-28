import type { PrismaClient } from "@prisma/client";
import type { ProjectContext } from "@nexus/types";

export interface CreateProjectInput {
  name: string;
  description: string;
  domainConfigId: string;
}

export interface ProjectRepository {
  create(
    input: CreateProjectInput,
  ): Promise<{ projectId: string; sessionId: string; createdAt: Date }>;
  findContextById(projectId: string): Promise<ProjectContext | null>;
  findActiveDomainConfigId(): Promise<string | null>;
  existsById(projectId: string): Promise<boolean>;
}

export function createProjectRepository(
  prisma: PrismaClient,
): ProjectRepository {
  return {
    async create(input) {
      return prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            name: input.name,
            description: input.description,
            domainConfigId: input.domainConfigId,
            status: "ACTIVE",
          },
        });
        const session = await tx.session.create({
          data: {
            projectId: project.id,
            status: "IN_PROGRESS",
          },
        });
        return {
          projectId: project.id,
          sessionId: session.id,
          createdAt: project.createdAt,
        };
      });
    },

    async findContextById(projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          collaborators: {
            include: { profile: true },
          },
        },
      });
      if (!project) {
        return null;
      }
      return {
        projectId: project.id,
        description: project.description,
        collaborators: project.collaborators.map((collaborator) => ({
          collaboratorId: collaborator.id,
          name: collaborator.name,
          profileType: collaborator.profile.type,
        })),
      };
    },

    async findActiveDomainConfigId() {
      const domainConfig = await prisma.domainConfig.findFirst({
        where: { active: true },
      });
      return domainConfig?.id ?? null;
    },

    async existsById(projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      return project !== null;
    },
  };
}
