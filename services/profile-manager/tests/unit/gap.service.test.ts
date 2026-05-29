import { describe, it, expect } from "vitest";
import type { ProfileType } from "@nexus/types";
import { createGapService } from "../../src/services/gap.service.js";
import type { GenerationService } from "../../src/services/gap.service.js";
import type {
  AnswerRepository,
  DimensionAnswerStats,
} from "../../src/repositories/answer.repository.js";

function fakeAnswerRepository(stats: DimensionAnswerStats[]): AnswerRepository {
  return {
    async getDimensionStatsForCollaborator() {
      return stats;
    },
  };
}

function fakeGeneration(response: string): GenerationService & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    async complete(prompt: string) {
      calls.push(prompt);
      return response;
    },
  };
}

const nullGeneration: GenerationService = {
  async complete() {
    throw new Error("generation should not be called");
  },
};

// Mirrors the production stub: a GenerationService that always returns null.
const stubGeneration: GenerationService = {
  async complete() {
    return null;
  },
};

describe("analyzeGaps", () => {
  it("reports no gap when every dimension is fully certain", async () => {
    const answerRepository = fakeAnswerRepository([
      { dimension: "TECHNICAL_JUSTIFICATION", total: 4, uncertainOrDelegated: 0 },
      { dimension: "REGULATORY_COMPLIANCE", total: 3, uncertainOrDelegated: 0 },
    ]);
    const service = createGapService(answerRepository, nullGeneration);
    const result = await service.analyzeGaps("s1", "c1", "ARCHITECT");
    expect(result.hasGap).toBe(false);
    expect(result.gaps).toEqual([]);
    expect(result.llmSuggestion).toBeNull();
  });

  it("reports a FOCUSED gap when one dimension exceeds GAP_THRESHOLD", async () => {
    const answerRepository = fakeAnswerRepository([
      { dimension: "TECHNICAL_JUSTIFICATION", total: 4, uncertainOrDelegated: 3 },
      { dimension: "REGULATORY_COMPLIANCE", total: 4, uncertainOrDelegated: 0 },
    ]);
    const service = createGapService(answerRepository, nullGeneration);
    const result = await service.analyzeGaps("s1", "c1", "ARCHITECT");
    expect(result.hasGap).toBe(true);
    expect(result.gaps[0].type).toBe("FOCUSED");
    expect(result.gaps[0].dimension).toBe("TECHNICAL_JUSTIFICATION");
    expect(result.llmSuggestion).toBeNull();
  });

  it("detects a DIFFUSE pattern and calls the generation service", async () => {
    const answerRepository = fakeAnswerRepository([
      { dimension: "TECHNICAL_JUSTIFICATION", total: 2, uncertainOrDelegated: 1 },
      { dimension: "REGULATORY_COMPLIANCE", total: 2, uncertainOrDelegated: 1 },
      { dimension: "PRIVACY_MECHANISMS", total: 2, uncertainOrDelegated: 1 },
    ]);
    const generation = fakeGeneration(
      '{"suggestedProfile": "REGULATORY", "justification": "Needs REGULATORY_COMPLIANCE depth."}',
    );
    const service = createGapService(answerRepository, generation);
    const result = await service.analyzeGaps("s1", "c1", "ARCHITECT");
    expect(result.hasGap).toBe(true);
    expect(result.gaps.every((g) => g.type === "DIFFUSE")).toBe(true);
    expect(result.gaps).toHaveLength(3);
    expect(generation.calls).toHaveLength(1);
    expect(result.llmSuggestion?.suggestedProfile).toBe("REGULATORY");
  });

  it("rejects a suggestion whose profile is outside the ProfileType enum", async () => {
    const answerRepository = fakeAnswerRepository([
      { dimension: "TECHNICAL_JUSTIFICATION", total: 2, uncertainOrDelegated: 1 },
      { dimension: "REGULATORY_COMPLIANCE", total: 2, uncertainOrDelegated: 1 },
      { dimension: "PRIVACY_MECHANISMS", total: 2, uncertainOrDelegated: 1 },
    ]);
    const generation = fakeGeneration(
      '{"suggestedProfile": "WIZARD", "justification": "Needs TECHNICAL_JUSTIFICATION depth."}',
    );
    const service = createGapService(answerRepository, generation);
    const result = await service.analyzeGaps("s1", "c1", "ARCHITECT");
    expect(result.hasGap).toBe(true);
    expect(result.llmSuggestion).toBeNull();
  });

  it("rejects a suggestion with an empty justification", async () => {
    const answerRepository = fakeAnswerRepository([
      { dimension: "TECHNICAL_JUSTIFICATION", total: 2, uncertainOrDelegated: 1 },
      { dimension: "REGULATORY_COMPLIANCE", total: 2, uncertainOrDelegated: 1 },
      { dimension: "PRIVACY_MECHANISMS", total: 2, uncertainOrDelegated: 1 },
    ]);
    const generation = fakeGeneration(
      '{"suggestedProfile": "REGULATORY", "justification": ""}',
    );
    const service = createGapService(answerRepository, generation);
    const result = await service.analyzeGaps("s1", "c1", "ARCHITECT");
    expect(result.hasGap).toBe(true);
    expect(result.llmSuggestion).toBeNull();
  });

  it("rejects a suggestion equal to the collaborator's current profile", async () => {
    const answerRepository = fakeAnswerRepository([
      { dimension: "TECHNICAL_JUSTIFICATION", total: 2, uncertainOrDelegated: 1 },
      { dimension: "REGULATORY_COMPLIANCE", total: 2, uncertainOrDelegated: 1 },
      { dimension: "PRIVACY_MECHANISMS", total: 2, uncertainOrDelegated: 1 },
    ]);
    const current: ProfileType = "ARCHITECT";
    const generation = fakeGeneration(
      '{"suggestedProfile": "ARCHITECT", "justification": "Needs TECHNICAL_JUSTIFICATION depth."}',
    );
    const service = createGapService(answerRepository, generation);
    const result = await service.analyzeGaps("s1", "c1", current);
    expect(result.hasGap).toBe(true);
    expect(result.llmSuggestion).toBeNull();
  });

  it("yields no suggestion when the generation stub returns null on a diffuse pattern", async () => {
    const answerRepository = fakeAnswerRepository([
      { dimension: "TECHNICAL_JUSTIFICATION", total: 2, uncertainOrDelegated: 1 },
      { dimension: "REGULATORY_COMPLIANCE", total: 2, uncertainOrDelegated: 1 },
      { dimension: "PRIVACY_MECHANISMS", total: 2, uncertainOrDelegated: 1 },
    ]);
    const service = createGapService(answerRepository, stubGeneration);
    const result = await service.analyzeGaps("s1", "c1", "ARCHITECT");
    expect(result.hasGap).toBe(true);
    expect(result.gaps.every((g) => g.type === "DIFFUSE")).toBe(true);
    expect(result.llmSuggestion).toBeNull();
  });
});
