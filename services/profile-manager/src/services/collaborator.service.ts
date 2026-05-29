import type {
  CollaboratorProfile,
  ProfileType,
  SessionStatus,
} from "@nexus/types";
import type { ProjectRepository } from "../repositories/project.repository.js";
import type { CollaboratorRepository } from "../repositories/collaborator.repository.js";
import type { SessionRepository } from "../repositories/session.repository.js";

export interface InviteCollaboratorPayload {
  projectId: string;
  name: string;
  email: string;
  suggestedProfile: ProfileType;
}

export interface InviteCollaboratorResult {
  collaboratorId: string;
  profileType: ProfileType;
  createdAt: Date;
}

export interface PatchProfilePayload {
  projectId: string;
  collaboratorId: string;
  profileType: ProfileType;
}

export interface CollaboratorService {
  inviteCollaborator(
    payload: InviteCollaboratorPayload,
  ): Promise<InviteCollaboratorResult>;
  getProfile(
    projectId: string,
    collaboratorId: string,
  ): Promise<CollaboratorProfile>;
  patchProfile(payload: PatchProfilePayload): Promise<CollaboratorProfile>;
  evaluateReadiness(sessionId: string): Promise<SessionStatus>;
}

export function createCollaboratorService(
  collaboratorRepository: CollaboratorRepository,
  projectRepository: ProjectRepository,
  sessionRepository: SessionRepository,
): CollaboratorService {
  return {
    async inviteCollaborator(payload) {
      const exists = await projectRepository.existsById(payload.projectId);
      if (!exists) {
        throw new Error("Project not found");
      }
      return collaboratorRepository.create({
        projectId: payload.projectId,
        name: payload.name,
        email: payload.email,
        profileType: payload.suggestedProfile,
      });
    },

    async getProfile(projectId, collaboratorId) {
      const profile = await collaboratorRepository.findProfileByCollaboratorId(
        projectId,
        collaboratorId,
      );
      if (!profile) {
        throw new Error("Collaborator not found");
      }
      return profile;
    },

    async patchProfile(payload) {
      return collaboratorRepository.updateProfile(
        payload.projectId,
        payload.collaboratorId,
        payload.profileType,
      );
    },

    async evaluateReadiness(sessionId) {
      const status = await sessionRepository.findStatusById(sessionId);
      if (!status) {
        throw new Error("Session not found");
      }
      if (status !== "SUFFICIENT" && status !== "AWAITING_DELEGATION") {
        return status;
      }
      const pending =
        await sessionRepository.countPendingDelegations(sessionId);
      const next: SessionStatus =
        pending > 0 ? "AWAITING_DELEGATION" : "READY_FOR_ARGUMENTATION";
      await sessionRepository.updateStatus(sessionId, next);
      return next;
    },
  };
}
