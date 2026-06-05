import type { PrismaClient } from "@prisma/client";
import type { ProjectContext, ProjectListItem } from "@nexus/types";

export interface CreateProjectInput {
  name: string;
  description: string;
  domainConfigId: string;
  ownerUserId: string;
  ownerEmail?: string;
}

export interface ProjectRepository {
  create(
    input: CreateProjectInput,
  ): Promise<{ projectId: string; sessionId: string; createdAt: Date }>;
  findContextById(projectId: string): Promise<ProjectContext | null>;
  findByUserId(userId: string): Promise<ProjectListItem[]>;
  findActiveDomainConfigId(): Promise<string | null>;
  existsById(projectId: string): Promise<boolean>;
}

export function createProjectRepository(
  prisma: PrismaClient,
): ProjectRepository {
  return {
    async create(input) {
      return prisma.$transaction(async (tx) => {
        // The creator is registered as the project's first collaborator (owner).
        // Identity lives in services/auth/; resolve the user record when present
        // and fall back to the JWT email otherwise.
        const user = await tx.user.findUnique({
          where: { id: input.ownerUserId },
          select: { email: true, name: true },
        });
        const ownerEmail = user?.email ?? input.ownerEmail;
        if (!ownerEmail) {
          throw new Error("Cannot resolve creator identity for project owner");
        }
        const ownerName = user?.name ?? ownerEmail.split("@")[0] ?? ownerEmail;

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
        const profile = await tx.profile.create({
          data: {
            type: "MANAGER",
            confidence: 0.7,
            identificationMethod: "DECLARATIVE",
          },
        });
        await tx.collaborator.create({
          data: {
            projectId: project.id,
            name: ownerName,
            email: ownerEmail,
            profileId: profile.id,
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

    async findByUserId(userId) {
      // User identity is owned by services/auth/. The Collaborator table links to
      // a user by email (no userId FK in this schema), so we resolve the user's
      // email first and then match collaborators by it.
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user) {
        return [];
      }

      const collaborations = await prisma.collaborator.findMany({
        where: { email: user.email },
        include: {
          project: {
            include: {
              sessions: { orderBy: { startedAt: "asc" }, take: 1 },
              collaborators: {
                orderBy: { joinedAt: "asc" },
                take: 1,
                select: { email: true },
              },
            },
          },
        },
      });

      return collaborations.map((collaboration) => {
        const project = collaboration.project;
        const firstCollaborator = project.collaborators[0];
        const userRole =
          firstCollaborator?.email === user.email ? "OWNER" : "COLLABORATOR";
        return {
          projectId: project.id,
          name: project.name,
          sessionStatus: project.sessions[0]?.status ?? "IN_PROGRESS",
          userRole,
        };
      });
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
