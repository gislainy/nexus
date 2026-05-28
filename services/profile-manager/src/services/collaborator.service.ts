import type { CollaboratorProfile, ProfileType } from "@nexus/types";
import type { ProjectRepository } from "../repositories/project.repository.js";
import type { CollaboratorRepository } from "../repositories/collaborator.repository.js";

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
}

export function createCollaboratorService(
  collaboratorRepository: CollaboratorRepository,
  projectRepository: ProjectRepository,
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
  };
}
