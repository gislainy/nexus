import { z } from "zod";

// ---------- Enums ----------

export const RecommendationVerdict = z.enum([
  "NOT_RECOMMENDED",
  "PARTIALLY_RECOMMENDED",
  "STRONGLY_RECOMMENDED",
]);
export type RecommendationVerdict = z.infer<typeof RecommendationVerdict>;

export const ArgumentAcceptabilityStatus = z.enum([
  "ACCEPTED",
  "DEFEATED",
  "SUSPENDED",
]);
export type ArgumentAcceptabilityStatus = z.infer<
  typeof ArgumentAcceptabilityStatus
>;

// ---------- Recommendation ----------

export const Recommendation = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  verdict: RecommendationVerdict,
  argumentAcceptability: z.record(z.string(), ArgumentAcceptabilityStatus),
  orientationText: z.string(),
  blockerDiagnosis: z.string().optional(),
  vetosTriggered: z.array(z.string()),
  generatedAt: z.date(),
});
export type Recommendation = z.infer<typeof Recommendation>;

// ---------- Argument ----------

export const Argument = z.object({
  id: z.string().uuid(),
  recommendationId: z.string().uuid(),
  dimension: z.string().min(1),
  grounds: z.array(z.string().uuid()),
  warrant: z.string(),
  backingChunkIds: z.array(z.string().uuid()),
  claim: z.string(),
  acceptability: ArgumentAcceptabilityStatus,
  defeatedBy: z.string().uuid().optional(),
  suspendedByVeto: z.string().optional(),
});
export type Argument = z.infer<typeof Argument>;
