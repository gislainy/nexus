import { z } from "zod";

// ---------- Enums ----------

export const ProjectStatus = z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

export const ProfileType = z.enum([
  "MANAGER",
  "ARCHITECT",
  "DEVELOPER",
  "CLINICAL",
  "REGULATORY",
]);
export type ProfileType = z.infer<typeof ProfileType>;

export const ProfileIdentificationMethod = z.enum([
  "DECLARATIVE",
  "OWNER_REVISION",
]);
export type ProfileIdentificationMethod = z.infer<
  typeof ProfileIdentificationMethod
>;

export const SessionStatus = z.enum([
  "IN_PROGRESS",
  "SUFFICIENT",
  "AWAITING_DELEGATION",
  "READY_FOR_ARGUMENTATION",
  "COMPLETED",
]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const Locale = z.enum(["pt", "en"]);
export type Locale = z.infer<typeof Locale>;

// ---------- Project ----------

export const Project = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  domainConfigId: z.string().uuid(),
  status: ProjectStatus,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Project = z.infer<typeof Project>;

// ---------- Collaborator ----------

export const Collaborator = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  profileId: z.string().uuid(),
  joinedAt: z.date(),
});
export type Collaborator = z.infer<typeof Collaborator>;

// ---------- Profile ----------

export const Profile = z.object({
  id: z.string().uuid(),
  type: ProfileType,
  confidence: z.number().min(0).max(1),
  identificationMethod: ProfileIdentificationMethod,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Profile = z.infer<typeof Profile>;

// ---------- Session ----------

export const Session = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  status: SessionStatus,
  xstateSnapshot: z.record(z.unknown()).optional(),
  startedAt: z.date(),
  completedAt: z.date().optional(),
});
export type Session = z.infer<typeof Session>;

// ---------- SessionContext (C1 → C3) ----------

export const SessionContext = z.object({
  projectId: z.string().uuid(),
  sessionId: z.string().uuid(),
  collaboratorId: z.string().uuid(),
  profileType: ProfileType,
  singleCollaborator: z.boolean(),
  locale: Locale,
});
export type SessionContext = z.infer<typeof SessionContext>;

// ---------- ProjectContext (C1 → C4) ----------

export const ProjectCollaboratorSummary = z.object({
  collaboratorId: z.string().uuid(),
  name: z.string(),
  profileType: ProfileType,
});
export type ProjectCollaboratorSummary = z.infer<
  typeof ProjectCollaboratorSummary
>;

export const ProjectContext = z.object({
  projectId: z.string().uuid(),
  description: z.string(),
  collaborators: z.array(ProjectCollaboratorSummary),
});
export type ProjectContext = z.infer<typeof ProjectContext>;
