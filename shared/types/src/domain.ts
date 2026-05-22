import { z } from "zod";

// ---------- Enums ----------

export const TechnicalDepth = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type TechnicalDepth = z.infer<typeof TechnicalDepth>;

export const EvaluationOperator = z.enum([
  "equals",
  "not_equals",
  "contains",
  "greater_than",
  "less_than",
]);
export type EvaluationOperator = z.infer<typeof EvaluationOperator>;

// ---------- Evaluation rule (recursive) ----------

export const LeafCondition = z.object({
  field: z.string(),
  operator: EvaluationOperator,
  value: z.union([z.string(), z.number(), z.boolean()]),
});
export type LeafCondition = z.infer<typeof LeafCondition>;

export type EvaluationRule =
  | LeafCondition
  | { operator: "AND"; conditions: EvaluationRule[] }
  | { operator: "OR"; conditions: EvaluationRule[] }
  | { operator: "NOT"; condition: EvaluationRule };

export const EvaluationRule: z.ZodType<EvaluationRule> = z.lazy(() =>
  z.union([
    LeafCondition,
    z.object({ operator: z.literal("AND"), conditions: z.array(EvaluationRule) }),
    z.object({ operator: z.literal("OR"), conditions: z.array(EvaluationRule) }),
    z.object({ operator: z.literal("NOT"), condition: EvaluationRule }),
  ]),
);

// ---------- DomainConfig ----------

export const DomainConfig = z.object({
  id: z.string().uuid(),
  domainName: z.string().min(1),
  domainVersion: z.string().min(1),
  description: z.string(),
  tagSet: z.array(z.string()).min(1),
  active: z.boolean().default(false),
  createdAt: z.date(),
  approvedBy: z.string(),
  approvedAt: z.date(),
});
export type DomainConfig = z.infer<typeof DomainConfig>;

// ---------- DimensionDefinition ----------

export const DimensionDefinition = z.object({
  id: z.string().min(1),
  domainConfigId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  tag: z.string().min(1),
});
export type DimensionDefinition = z.infer<typeof DimensionDefinition>;

// ---------- ProfileDefinition ----------

export const ProfileDefinition = z.object({
  id: z.string().min(1),
  domainConfigId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  vocabulary: z.array(z.string()),
  technicalDepth: TechnicalDepth,
});
export type ProfileDefinition = z.infer<typeof ProfileDefinition>;

// ---------- WarrantDefinition ----------

export const WarrantDefinition = z.object({
  id: z.string().min(1),
  domainConfigId: z.string().uuid(),
  dimensionId: z.string().min(1),
  structuralWarrant: z.string().min(1),
  sources: z.array(z.string()).min(1),
});
export type WarrantDefinition = z.infer<typeof WarrantDefinition>;

// ---------- VetoDefinition ----------

export const VetoDefinition = z.object({
  id: z.string().min(1),
  domainConfigId: z.string().uuid(),
  condition: z.string().min(1),
  description: z.string(),
  evaluationRule: EvaluationRule,
  remediationPath: z.array(z.string()).min(1),
  sources: z.array(z.string()).min(1),
});
export type VetoDefinition = z.infer<typeof VetoDefinition>;

// ---------- ConflictDefinition ----------

export const ConflictDefinition = z.object({
  id: z.string().uuid(),
  domainConfigId: z.string().uuid(),
  dimensionAId: z.string().min(1),
  dimensionBId: z.string().min(1),
  conditionA: EvaluationRule,
  conditionB: EvaluationRule,
  description: z.string(),
});
export type ConflictDefinition = z.infer<typeof ConflictDefinition>;

// ---------- ArtifactVariable ----------

export const ArtifactVariable = z.object({
  id: z.string().min(1),
  domainConfigId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  extractionHint: z.string(),
  mapsToQuestionId: z.string().min(1),
});
export type ArtifactVariable = z.infer<typeof ArtifactVariable>;
