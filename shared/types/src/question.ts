import { z } from "zod";
import { ProfileType, Locale } from "./project.js";
import { EvaluationOperator } from "./domain.js";

// ---------- Enums ----------

export const EvaluationDimension = z.enum([
  "TECHNICAL_JUSTIFICATION",
  "REGULATORY_COMPLIANCE",
  "BLOCKCHAIN_TYPE",
  "PRIVACY_MECHANISMS",
  "IMPLEMENTATION_CAPACITY",
  "CONSENSUS_ADEQUACY",
]);
export type EvaluationDimension = z.infer<typeof EvaluationDimension>;

export const QuestionInputType = z.enum([
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "TEXT",
  "SCALE",
]);
export type QuestionInputType = z.infer<typeof QuestionInputType>;

export const QuestionInstanceStatus = z.enum([
  "PENDING",
  "ANSWERED",
  "SKIPPED",
]);
export type QuestionInstanceStatus = z.infer<typeof QuestionInstanceStatus>;

export const AnswerConfidence = z.enum([
  "CERTAIN",
  "UNCERTAIN",
  "DELEGATED",
]);
export type AnswerConfidence = z.infer<typeof AnswerConfidence>;

export const AnswerSource = z.enum(["MANUAL", "ARTIFACT"]);
export type AnswerSource = z.infer<typeof AnswerSource>;

// ---------- QuestionTemplate ----------

export const QuestionTemplate = z.object({
  id: z.string().min(1),
  domainConfigId: z.string().uuid(),
  dimension: z.string().min(1), // string in runtime to allow generic domains
  targetProfiles: z.array(ProfileType),
  textPt: z.string(),
  textEn: z.string(),
  textByProfile: z.record(
    z.record(Locale, z.string()),
  ),
  inputType: QuestionInputType,
  options: z.array(z.string()).optional(),
  isCriticalForArgument: z.boolean(),
  isEntryNode: z.boolean(),
});
export type QuestionTemplate = z.infer<typeof QuestionTemplate>;

// ---------- QuestionGuard ----------

export const QuestionGuard = z.object({
  questionTemplateId: z.string().min(1),
  operator: EvaluationOperator,
  value: z.union([z.string(), z.number(), z.boolean()]),
});
export type QuestionGuard = z.infer<typeof QuestionGuard>;

// ---------- QuestionTemplateEdge ----------

export const QuestionTemplateEdge = z.object({
  id: z.string().uuid(),
  sourceTemplateId: z.string().min(1),
  targetTemplateId: z.string().min(1),
  dimension: z.string().min(1),
  guard: QuestionGuard.optional(),
  profileTypes: z.array(ProfileType).optional(),
});
export type QuestionTemplateEdge = z.infer<typeof QuestionTemplateEdge>;

// ---------- QuestionInstance ----------

export const QuestionInstance = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  templateId: z.string().optional(),
  parentInstanceId: z.string().uuid().optional(),
  generatedByLLM: z.boolean(),
  llmPromptUsed: z.string().optional(),
  textShown: z.string(),
  dimension: z.string().min(1),
  inputType: QuestionInputType,
  options: z.array(z.string()).optional(),
  status: QuestionInstanceStatus,
  order: z.number().int().nonnegative(),
  createdAt: z.date(),
  skippedAt: z.date().optional(),
});
export type QuestionInstance = z.infer<typeof QuestionInstance>;

// ---------- Answer ----------

export const Answer = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  questionInstanceId: z.string().uuid(),
  collaboratorId: z.string().uuid(),
  value: z.string(),
  confidence: AnswerConfidence,
  delegatedTo: z.string().uuid().optional(),
  epistemicConfidence: z.number().min(0).max(1),
  answeredAt: z.date(),
  source: AnswerSource,
  artifactExtractionId: z.string().uuid().optional(),
  generatedByLLM: z.boolean(),
});
export type Answer = z.infer<typeof Answer>;

// ---------- ElicitationResult (C3 → C5) ----------

export const ElicitationAnswerProjection = z.object({
  questionInstanceId: z.string().uuid(),
  questionTemplateId: z.string().optional(),
  collaboratorId: z.string().uuid(),
  dimension: z.string().min(1),
  value: z.string(),
  confidence: AnswerConfidence,
  epistemicConfidence: z.number().min(0).max(1),
  source: AnswerSource,
  generatedByLLM: z.boolean(),
});
export type ElicitationAnswerProjection = z.infer<
  typeof ElicitationAnswerProjection
>;

export const ElicitationResult = z.object({
  sessionId: z.string().uuid(),
  sufficiencyCriteriaMet: z.boolean(),
  answers: z.array(ElicitationAnswerProjection),
});
export type ElicitationResult = z.infer<typeof ElicitationResult>;
