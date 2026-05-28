import type { PrismaClient } from "@prisma/client";
import type { CollaboratorProfile, ProfileType } from "@nexus/types";

export interface CreateCollaboratorInput {
  projectId: string;
  name: string;
  email: string;
  profileType: ProfileType;
}

export interface CollaboratorRepository {
  create(input: CreateCollaboratorInput): Promise<{
    collaboratorId: string;
    profileType: ProfileType;
    createdAt: Date;
  }>;
  findProfileByCollaboratorId(
    projectId: string,
    collaboratorId: string,
  ): Promise<CollaboratorProfile | null>;
  updateProfile(
    projectId: string,
    collaboratorId: string,
    profileType: ProfileType,
  ): Promise<CollaboratorProfile>;
}

// The Profile model has no ProfileEvent table, so the original pre-revision
// type cannot be reconstructed. History is synthesized from createdAt/updatedAt
// and always reports the current profile type for both events.
function buildProfile(collaborator: {
  id: string;
  profile: {
    type: ProfileType;
    confidence: number;
    identificationMethod: string;
    createdAt: Date;
    updatedAt: Date;
  };
}): CollaboratorProfile {
  const { profile } = collaborator;
  const history: CollaboratorProfile["history"] = [
    {
      type: "INITIAL_DECLARATION",
      profileType: profile.type,
      confidence: profile.confidence,
      identificationMethod:
        profile.identificationMethod as CollaboratorProfile["identificationMethod"],
      occurredAt: profile.createdAt.toISOString(),
    },
  ];
  if (profile.identificationMethod === "OWNER_REVISION") {
    history.push({
      type: "EXPLICIT_REVISION",
      profileType: profile.type,
      confidence: profile.confidence,
      identificationMethod: "OWNER_REVISION",
      occurredAt: profile.updatedAt.toISOString(),
    });
  }
  return {
    collaboratorId: collaborator.id,
    profileType: profile.type,
    confidence: profile.confidence,
    identificationMethod:
      profile.identificationMethod as CollaboratorProfile["identificationMethod"],
    history,
  };
}

export function createCollaboratorRepository(
  prisma: PrismaClient,
): CollaboratorRepository {
  return {
    async create(input) {
      return prisma.$transaction(async (tx) => {
        const profile = await tx.profile.create({
          data: {
            type: input.profileType,
            confidence: 0.7,
            identificationMethod: "DECLARATIVE",
          },
        });
        const collaborator = await tx.collaborator.create({
          data: {
            projectId: input.projectId,
            name: input.name,
            email: input.email,
            profileId: profile.id,
          },
        });
        return {
          collaboratorId: collaborator.id,
          profileType: profile.type,
          createdAt: profile.createdAt,
        };
      });
    },

    async findProfileByCollaboratorId(projectId, collaboratorId) {
      const collaborator = await prisma.collaborator.findFirst({
        where: { id: collaboratorId, projectId },
        include: { profile: true },
      });
      if (!collaborator) {
        return null;
      }
      return buildProfile(collaborator);
    },

    async updateProfile(projectId, collaboratorId, profileType) {
      const collaborator = await prisma.collaborator.findFirst({
        where: { id: collaboratorId, projectId },
        include: { profile: true },
      });
      if (!collaborator) {
        throw new Error("Collaborator not found");
      }
      await prisma.profile.update({
        where: { id: collaborator.profileId },
        data: {
          type: profileType,
          confidence: 1.0,
          identificationMethod: "OWNER_REVISION",
        },
      });
      const updated = await prisma.collaborator.findFirst({
        where: { id: collaboratorId, projectId },
        include: { profile: true },
      });
      return buildProfile(updated!);
    },
  };
}
