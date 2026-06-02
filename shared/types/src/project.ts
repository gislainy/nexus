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

// ---------- ProfileEvent (synthetic history — no table in schema) ----------

export const ProfileEventType = z.enum([
  "INITIAL_DECLARATION",
  "EXPLICIT_REVISION",
]);
export type ProfileEventType = z.infer<typeof ProfileEventType>;

export const ProfileEvent = z.object({
  type: ProfileEventType,
  profileType: ProfileType,
  confidence: z.number(),
  identificationMethod: ProfileIdentificationMethod,
  occurredAt: z.string().datetime(),
});
export type ProfileEvent = z.infer<typeof ProfileEvent>;

// ---------- CollaboratorProfile (GET /profile response) ----------

export const CollaboratorProfile = z.object({
  collaboratorId: z.string().uuid(),
  profileType: ProfileType,
  confidence: z.number(),
  identificationMethod: ProfileIdentificationMethod,
  history: z.array(ProfileEvent),
});
export type CollaboratorProfile = z.infer<typeof CollaboratorProfile>;

// ---------- InviteCollaboratorInput (POST /collaborators body) ----------

export const InviteCollaboratorInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  suggestedProfile: ProfileType,
});
export type InviteCollaboratorInput = z.infer<typeof InviteCollaboratorInput>;

// ---------- EpistemicAlignment ----------

export const DIMENSION_KEYS = [
  "TECHNICAL_JUSTIFICATION",
  "REGULATORY_COMPLIANCE",
  "BLOCKCHAIN_TYPE",
  "PRIVACY_MECHANISMS",
  "IMPLEMENTATION_CAPACITY",
  "CONSENSUS_ADEQUACY",
] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export const ALIGNMENT_MATRIX: Record<
  ProfileType,
  Record<DimensionKey, number>
> = {
  MANAGER: {
    TECHNICAL_JUSTIFICATION: 0.4,
    REGULATORY_COMPLIANCE: 0.9,
    BLOCKCHAIN_TYPE: 0.5,
    PRIVACY_MECHANISMS: 0.6,
    IMPLEMENTATION_CAPACITY: 0.3,
    CONSENSUS_ADEQUACY: 0.4,
  },
  ARCHITECT: {
    TECHNICAL_JUSTIFICATION: 0.9,
    REGULATORY_COMPLIANCE: 0.6,
    BLOCKCHAIN_TYPE: 0.8,
    PRIVACY_MECHANISMS: 0.7,
    IMPLEMENTATION_CAPACITY: 0.7,
    CONSENSUS_ADEQUACY: 0.8,
  },
  DEVELOPER: {
    TECHNICAL_JUSTIFICATION: 0.8,
    REGULATORY_COMPLIANCE: 0.4,
    BLOCKCHAIN_TYPE: 0.6,
    PRIVACY_MECHANISMS: 0.6,
    IMPLEMENTATION_CAPACITY: 0.9,
    CONSENSUS_ADEQUACY: 0.7,
  },
  CLINICAL: {
    TECHNICAL_JUSTIFICATION: 0.4,
    REGULATORY_COMPLIANCE: 0.7,
    BLOCKCHAIN_TYPE: 0.4,
    PRIVACY_MECHANISMS: 0.8,
    IMPLEMENTATION_CAPACITY: 0.3,
    CONSENSUS_ADEQUACY: 0.3,
  },
  REGULATORY: {
    TECHNICAL_JUSTIFICATION: 0.5,
    REGULATORY_COMPLIANCE: 1.0,
    BLOCKCHAIN_TYPE: 0.5,
    PRIVACY_MECHANISMS: 0.9,
    IMPLEMENTATION_CAPACITY: 0.4,
    CONSENSUS_ADEQUACY: 0.5,
  },
};

export const CONFIDENCE_MULTIPLIER: Record<
  "CERTAIN" | "UNCERTAIN" | "DELEGATED",
  number
> = {
  CERTAIN: 1.0,
  UNCERTAIN: 0.5,
  DELEGATED: 0.0,
};

export function calculateEpistemicConfidence(
  profileType: ProfileType,
  dimension: DimensionKey,
  signal: "CERTAIN" | "UNCERTAIN" | "DELEGATED",
): number {
  const alignment = ALIGNMENT_MATRIX[profileType][dimension];
  const multiplier = CONFIDENCE_MULTIPLIER[signal];
  return alignment * multiplier;
}

// ---------- Gap Analysis ----------

export const GAP_THRESHOLD = 0.6;
export const DIFFUSE_GAP_THRESHOLD = 0.35;
export const DIFFUSE_GAP_MIN_DIMENSIONS = 3;

export interface DimensionGapReport {
  dimension: DimensionKey;
  gapRatio: number;
  type: "FOCUSED" | "DIFFUSE";
}

export interface LLMProfileSuggestion {
  suggestedProfile: ProfileType;
  justification: string;
  promptUsed: string;
  rawResponse: string;
}

export interface GapAnalysisResult {
  hasGap: boolean;
  gaps: DimensionGapReport[];
  llmSuggestion: LLMProfileSuggestion | null;
}

// ---------- Conflict Detection ----------

// Maximum allowed distance between two normalized SCALE values before the
// answers are treated as contradictory.
export const SCALE_CONFLICT_THRESHOLD = 0.4;
