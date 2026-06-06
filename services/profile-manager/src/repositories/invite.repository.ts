import type { PrismaClient } from "@prisma/client";
import type { InviteStatus, ProfileType } from "@nexus/types";

export interface CreateInviteRecordInput {
  projectId: string;
  invitedBy: string;
  inviteeEmail: string;
  suggestedProfile: ProfileType;
  token: string;
  expiresAt: Date;
}

export interface InviteRecord {
  id: string;
  projectId: string;
  projectName: string;
  invitedByName: string;
  inviteeEmail: string;
  suggestedProfile: ProfileType;
  status: InviteStatus;
  expiresAt: Date;
}

export interface CreateCollaboratorFromInviteInput {
  projectId: string;
  userId: string;
  name: string;
  email: string;
  confirmedProfile: ProfileType;
}

export interface InviteRepository {
  isActiveCollaborator(projectId: string, email: string): Promise<boolean>;
  hasPendingInvite(projectId: string, email: string): Promise<boolean>;
  create(input: CreateInviteRecordInput): Promise<{ inviteId: string }>;
  findByToken(token: string): Promise<InviteRecord | null>;
  markExpired(inviteId: string): Promise<void>;
  markAccepted(inviteId: string): Promise<void>;
  markDeclined(inviteId: string): Promise<void>;
  createCollaboratorFromInvite(
    input: CreateCollaboratorFromInviteInput,
  ): Promise<{ collaboratorId: string }>;
}

export function createInviteRepository(
  prisma: PrismaClient,
): InviteRepository {
  return {
    async isActiveCollaborator(projectId, email) {
      const collaborator = await prisma.collaborator.findFirst({
        where: { projectId, email },
        select: { id: true },
      });
      return collaborator !== null;
    },

    async hasPendingInvite(projectId, email) {
      const invite = await prisma.collaboratorInvite.findFirst({
        where: { projectId, inviteeEmail: email, status: "PENDING" },
        select: { id: true },
      });
      return invite !== null;
    },

    async create(input) {
      const invite = await prisma.collaboratorInvite.create({
        data: {
          projectId: input.projectId,
          invitedBy: input.invitedBy,
          inviteeEmail: input.inviteeEmail,
          suggestedProfile: input.suggestedProfile,
          token: input.token,
          expiresAt: input.expiresAt,
        },
      });
      return { inviteId: invite.id };
    },

    async findByToken(token) {
      const invite = await prisma.collaboratorInvite.findUnique({
        where: { token },
        include: {
          project: { select: { name: true } },
          inviter: { select: { name: true } },
        },
      });
      if (!invite) {
        return null;
      }
      return {
        id: invite.id,
        projectId: invite.projectId,
        projectName: invite.project.name,
        invitedByName: invite.inviter.name,
        inviteeEmail: invite.inviteeEmail,
        suggestedProfile: invite.suggestedProfile as ProfileType,
        status: invite.status as InviteStatus,
        expiresAt: invite.expiresAt,
      };
    },

    async markExpired(inviteId) {
      await prisma.collaboratorInvite.update({
        where: { id: inviteId },
        data: { status: "EXPIRED" },
      });
    },

    async markAccepted(inviteId) {
      await prisma.collaboratorInvite.update({
        where: { id: inviteId },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
    },

    async markDeclined(inviteId) {
      await prisma.collaboratorInvite.update({
        where: { id: inviteId },
        data: { status: "DECLINED" },
      });
    },

    async createCollaboratorFromInvite(input) {
      return prisma.$transaction(async (tx) => {
        const profile = await tx.profile.create({
          data: {
            type: input.confirmedProfile,
            confidence: 0.7,
            identificationMethod: "DECLARATIVE",
          },
        });
        const collaborator = await tx.collaborator.create({
          data: {
            projectId: input.projectId,
            userId: input.userId,
            name: input.name,
            email: input.email,
            profileId: profile.id,
          },
        });
        return { collaboratorId: collaborator.id };
      });
    },
  };
}
