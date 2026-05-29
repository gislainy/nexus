import {
  GAP_THRESHOLD,
  DIFFUSE_GAP_THRESHOLD,
  DIFFUSE_GAP_MIN_DIMENSIONS,
  ProfileType,
  type DimensionKey,
  type DimensionGapReport,
  type GapAnalysisResult,
  type LLMProfileSuggestion,
} from "@nexus/types";
import type { AnswerRepository } from "../repositories/answer.repository.js";

// Abstraction over the LLM so the service stays testable. The concrete
// implementation is a stub returning null until a model is selected and
// benchmarked; when complete resolves to null, no suggestion is produced.
export interface GenerationService {
  complete(prompt: string): Promise<string | null>;
}

export interface GapService {
  analyzeGaps(
    sessionId: string,
    collaboratorId: string,
    profileType: ProfileType,
  ): Promise<GapAnalysisResult>;
}

interface DimensionRatio {
  dimension: DimensionKey;
  gapRatio: number;
}

function buildSuggestionPrompt(
  profileType: ProfileType,
  ratios: DimensionRatio[],
  diffuseDimensions: DimensionKey[],
): string {
  const distribution = ratios
    .map((r) => `- ${r.dimension}: gapRatio=${r.gapRatio.toFixed(2)}`)
    .join("\n");
  return [
    "A collaborator filling a digital-health blockchain assessment shows a diffuse uncertainty pattern across several dimensions.",
    `Current declared profile: ${profileType}.`,
    "Gap ratio per dimension (share of uncertain or delegated answers):",
    distribution,
    `Dimensions with notable gaps: ${diffuseDimensions.join(", ")}.`,
    `Suggest one complementary profile from this set: ${ProfileType.options.join(", ")}.`,
    "The suggested profile must be different from the current profile.",
    'Respond strictly as JSON: {"suggestedProfile": "<PROFILE>", "justification": "<text referencing at least one gap dimension>"}.',
  ].join("\n");
}

function parseSuggestion(raw: string): {
  suggestedProfile: string;
  justification: string;
} | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const suggestedProfile = parsed.suggestedProfile;
    const justification = parsed.justification;
    if (
      typeof suggestedProfile !== "string" ||
      typeof justification !== "string"
    ) {
      return null;
    }
    return { suggestedProfile, justification };
  } catch {
    return null;
  }
}

function validateSuggestion(
  parsed: { suggestedProfile: string; justification: string },
  currentProfile: ProfileType,
  gapDimensions: DimensionKey[],
): ProfileType | null {
  const profileResult = ProfileType.safeParse(parsed.suggestedProfile);
  if (!profileResult.success) {
    return null;
  }
  const suggested = profileResult.data;
  const justification = parsed.justification.trim();
  if (justification.length === 0) {
    return null;
  }
  const referencesGap = gapDimensions.some((dimension) =>
    justification.toUpperCase().includes(dimension),
  );
  if (!referencesGap) {
    return null;
  }
  if (suggested === currentProfile) {
    return null;
  }
  return suggested;
}

export function createGapService(
  answerRepository: AnswerRepository,
  generationService: GenerationService,
): GapService {
  return {
    async analyzeGaps(sessionId, collaboratorId, profileType) {
      const stats = await answerRepository.getDimensionStatsForCollaborator(
        sessionId,
        collaboratorId,
      );

      const ratios: DimensionRatio[] = stats
        .filter((stat) => stat.total > 0)
        .map((stat) => ({
          dimension: stat.dimension as DimensionKey,
          gapRatio: stat.uncertainOrDelegated / stat.total,
        }));

      const focused = ratios.filter((r) => r.gapRatio > GAP_THRESHOLD);

      if (focused.length > 0) {
        const gaps: DimensionGapReport[] = focused.map((r) => ({
          dimension: r.dimension,
          gapRatio: r.gapRatio,
          type: "FOCUSED",
        }));
        return { hasGap: true, gaps, llmSuggestion: null };
      }

      const diffuse = ratios.filter(
        (r) => r.gapRatio > DIFFUSE_GAP_THRESHOLD,
      );

      if (diffuse.length >= DIFFUSE_GAP_MIN_DIMENSIONS) {
        const gaps: DimensionGapReport[] = diffuse.map((r) => ({
          dimension: r.dimension,
          gapRatio: r.gapRatio,
          type: "DIFFUSE",
        }));
        const gapDimensions = diffuse.map((r) => r.dimension);
        const prompt = buildSuggestionPrompt(profileType, ratios, gapDimensions);
        const rawResponse = await generationService.complete(prompt);
        const parsed =
          rawResponse !== null ? parseSuggestion(rawResponse) : null;
        const suggested = parsed
          ? validateSuggestion(parsed, profileType, gapDimensions)
          : null;
        const llmSuggestion: LLMProfileSuggestion | null =
          rawResponse !== null && parsed && suggested
            ? {
                suggestedProfile: suggested,
                justification: parsed.justification,
                promptUsed: prompt,
                rawResponse,
              }
            : null;
        return { hasGap: true, gaps, llmSuggestion };
      }

      return { hasGap: false, gaps: [], llmSuggestion: null };
    },
  };
}
