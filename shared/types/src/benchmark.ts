import { z } from "zod";

// ---------- Enums ----------

export const ExperimentStatus = z.enum([
  "PLANNED",
  "RUNNING",
  "EVALUATING",
  "COMPLETED",
]);
export type ExperimentStatus = z.infer<typeof ExperimentStatus>;

export const EvaluationMethod = z.enum([
  "MANUAL",
  "AUTOMATED",
  "LLM_AS_JUDGE",
]);
export type EvaluationMethod = z.infer<typeof EvaluationMethod>;

// ---------- LLMBenchmarkRecord ----------

export const LLMBenchmarkRecord = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid().optional(),
  provider: z.string().min(1),
  component: z.string().min(1),
  task: z.string().min(1),
  prompt: z.string(),
  response: z.string(),
  latencyMs: z.number().int().nonnegative(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  evaluationScore: z.number().min(0).max(1).optional(),
  timestamp: z.date(),
});
export type LLMBenchmarkRecord = z.infer<typeof LLMBenchmarkRecord>;

// ---------- BenchmarkPrompt ----------

export const BenchmarkPrompt = z.object({
  id: z.string().min(1),
  input: z.string(),
  expectedOutput: z.string().optional(),
  context: z.string().optional(),
});
export type BenchmarkPrompt = z.infer<typeof BenchmarkPrompt>;

// ---------- EvaluationCriteria ----------

export const EvaluationCriteria = z.object({
  primaryMetric: z.string().min(1),
  secondaryMetrics: z.array(z.string()),
  method: EvaluationMethod,
  minimumAcceptableScore: z.number().min(0).max(1),
  notes: z.string().optional(),
});
export type EvaluationCriteria = z.infer<typeof EvaluationCriteria>;

// ---------- BenchmarkExperiment ----------

export const BenchmarkExperiment = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  component: z.string().min(1),
  task: z.string().min(1),
  candidateModels: z.array(z.string()).min(1),
  testPrompts: z.array(BenchmarkPrompt).min(1),
  evaluationCriteria: EvaluationCriteria,
  status: ExperimentStatus,
  winnerModel: z.string().optional(),
  decisionRationale: z.string().optional(),
  createdAt: z.date(),
  completedAt: z.date().optional(),
});
export type BenchmarkExperiment = z.infer<typeof BenchmarkExperiment>;

// ---------- BenchmarkRun ----------

export const BenchmarkRun = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  promptId: z.string().min(1),
  provider: z.string().min(1),
  response: z.string(),
  latencyMs: z.number().int().nonnegative(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  evaluationScore: z.number().min(0).max(1),
  evaluationMethod: EvaluationMethod,
  evaluationNotes: z.string().optional(),
  ranAt: z.date(),
});
export type BenchmarkRun = z.infer<typeof BenchmarkRun>;
