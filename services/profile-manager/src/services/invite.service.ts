import { randomUUID } from "node:crypto";
import type { CreateInviteInput, InviteDetails, ProfileType } from "@nexus/types";
import type { ProjectRepository } from "../repositories/project.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type {
  InviteRecord,
  InviteRepository,
} from "../repositories/invite.repository.js";

// Days an invite stays valid before it is treated as expired.
const INVITE_TTL_DAYS = 7;
const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

const INVITE_NOT_FOUND = "Invite not found or expired";

export interface InviteLogger {
  info(message: string): void;
}

export interface InviteService {
  createInvite(
    projectId: string,
    invitedBy: string,
    input: CreateInviteInput,
  ): Promise<{ inviteId: string; token: string }>;
  getInviteByToken(token: string): Promise<InviteDetails>;
  acceptInvite(
    token: string,
    confirmedProfile: ProfileType,
  ): Promise<{ collaboratorId: string }>;
  declineInvite(token: string): Promise<void>;
}

export function createInviteService(
  inviteRepository: InviteRepository,
  userRepository: UserRepository,
  projectRepository: ProjectRepository,
  logger: InviteLogger,
): InviteService {
  // Loads an invite that is still actionable: it must exist, be PENDING, and not
  // be past its expiry. An expired invite is flipped to EXPIRED before failing,
  // so the stale state is recorded. All failure modes surface the same opaque
  // message so a token probe cannot distinguish "wrong" from "consumed".
  async function loadActiveInvite(token: string): Promise<InviteRecord> {
    const invite = await inviteRepository.findByToken(token);
    if (!invite || invite.status !== "PENDING") {
      throw new Error(INVITE_NOT_FOUND);
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      await inviteRepository.markExpired(invite.id);
      throw new Error(INVITE_NOT_FOUND);
    }
    return invite;
  }

  return {
    async createInvite(projectId, invitedBy, input) {
      const projectExists = await projectRepository.existsById(projectId);
      if (!projectExists) {
        throw new Error("Project not found");
      }
      const alreadyCollaborator = await inviteRepository.isActiveCollaborator(
        projectId,
        input.inviteeEmail,
      );
      if (alreadyCollaborator) {
        throw new Error("Collaborator already active");
      }
      const pending = await inviteRepository.hasPendingInvite(
        projectId,
        input.inviteeEmail,
      );
      if (pending) {
        throw new Error("Invite already pending for this email");
      }

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      const { inviteId } = await inviteRepository.create({
        projectId,
        invitedBy,
        inviteeEmail: input.inviteeEmail,
        suggestedProfile: input.suggestedProfile,
        token,
        expiresAt,
      });

      // Email stub: real delivery is future work. The link is logged so the
      // flow can be exercised end-to-end without an email provider.
      logger.info(`[INVITE] Token para ${input.inviteeEmail}: /invites/${token}`);

      return { inviteId, token };
    },

    async getInviteByToken(token) {
      const invite = await loadActiveInvite(token);
      const user = await userRepository.findByEmail(invite.inviteeEmail);
      return {
        inviteId: invite.id,
        projectId: invite.projectId,
        projectName: invite.projectName,
        invitedByName: invite.invitedByName,
        inviteeEmail: invite.inviteeEmail,
        suggestedProfile: invite.suggestedProfile,
        status: invite.status,
        isNewUser: user === null,
        expiresAt: invite.expiresAt.toISOString(),
      };
    },

    async acceptInvite(token, confirmedProfile) {
      const invite = await loadActiveInvite(token);
      const user = await userRepository.findByEmail(invite.inviteeEmail);
      if (!user) {
        throw new Error("User not found for invite email");
      }
      const { collaboratorId } =
        await inviteRepository.createCollaboratorFromInvite({
          projectId: invite.projectId,
          userId: user.id,
          name: user.name,
          email: invite.inviteeEmail,
          confirmedProfile,
        });
      await inviteRepository.markAccepted(invite.id);
      return { collaboratorId };
    },

    async declineInvite(token) {
      const invite = await loadActiveInvite(token);
      await inviteRepository.markDeclined(invite.id);
    },
  };
}
