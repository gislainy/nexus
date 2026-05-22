import { z } from "zod";

// ---------- Enums ----------

export const GitConnectionStatus = z.enum([
  "CONNECTED",
  "SYNCING",
  "FAILED",
]);
export type GitConnectionStatus = z.infer<typeof GitConnectionStatus>;

export const ArtifactType = z.enum([
  "CODE",
  "DOCUMENTATION",
  "ARCHITECTURE_DIAGRAM",
  "FHIR_RESOURCE",
  "HL7_MESSAGE",
  "OPENEHR_ARCHETYPE",
  "DICOM_CONFIG",
  "OTHER",
]);
export type ArtifactType = z.infer<typeof ArtifactType>;

export const ArtifactOrigin = z.enum(["GIT", "UPLOAD"]);
export type ArtifactOrigin = z.infer<typeof ArtifactOrigin>;

export const ArtifactAnalysisStatus = z.enum([
  "PENDING",
  "ANALYZED",
  "FAILED",
]);
export type ArtifactAnalysisStatus = z.infer<typeof ArtifactAnalysisStatus>;

export const PassageLayer = z.enum(["core", "expanded"]);
export type PassageLayer = z.infer<typeof PassageLayer>;

// ---------- GitConnection ----------

export const GitConnection = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  gitRepoUrl: z.string().url(),
  branch: z.string().min(1),
  commitSha: z.string().min(1),
  status: GitConnectionStatus,
  connectedAt: z.date(),
  lastSyncAt: z.date().optional(),
});
export type GitConnection = z.infer<typeof GitConnection>;

// ---------- Artifact ----------

export const Artifact = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  gitConnectionId: z.string().uuid().optional(),
  type: ArtifactType,
  origin: ArtifactOrigin,
  filename: z.string().min(1),
  filePath: z.string().optional(),
  storageKey: z.string().min(1),
  storageBucket: z.string().min(1),
  storageSizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
  analysisStatus: ArtifactAnalysisStatus,
  createdAt: z.date(),
  analyzedAt: z.date().optional(),
});
export type Artifact = z.infer<typeof Artifact>;

// ---------- ArtifactExtraction ----------

export const ArtifactExtraction = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  questionTemplateId: z.string().min(1),
  extractedValue: z.string(),
  confidence: z.number().min(0).max(1),
  evidenceSnippet: z.string(),
  extractedAt: z.date(),
});
export type ArtifactExtraction = z.infer<typeof ArtifactExtraction>;

// ---------- RetrievedPassage (C4 contract) ----------

export const RetrievedPassageSource = z.object({
  authors: z.array(z.string()),
  year: z.number().int(),
  title: z.string(),
  venue: z.string(),
  pageRef: z.string().optional(),
});

export const RetrievedPassage = z.object({
  chunkId: z.string().uuid(),
  text: z.string(),
  claim: z.string().optional(),
  score: z.number(),
  layer: PassageLayer,
  source: RetrievedPassageSource,
});
export type RetrievedPassage = z.infer<typeof RetrievedPassage>;

export const RetrievalRequest = z.object({
  queryText: z.string().min(1),
  topK: z.number().int().positive(),
  tag: z.string().optional(),
});
export type RetrievalRequest = z.infer<typeof RetrievalRequest>;

export const RetrievalResponse = z.object({
  hasEvidence: z.boolean(),
  passages: z.array(RetrievedPassage),
});
export type RetrievalResponse = z.infer<typeof RetrievalResponse>;
