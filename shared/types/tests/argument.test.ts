import { describe, expect, it } from "vitest";
import { Argument, Recommendation } from "../src/argument.js";

const UUID = "00000000-0000-0000-0000-000000000040";
const UUID2 = "00000000-0000-0000-0000-000000000041";

describe("Recommendation & Argument", () => {
  it("accepts a valid recommendation", () => {
    const ok = Recommendation.safeParse({
      id: UUID,
      sessionId: UUID2,
      verdict: "PARTIALLY_RECOMMENDED",
      argumentAcceptability: { TECHNICAL_JUSTIFICATION: "ACCEPTED" },
      orientationText: "ok",
      vetosTriggered: [],
      generatedAt: new Date(),
    });
    expect(ok.success).toBe(true);
  });

  it("rejects a bad verdict", () => {
    const bad = Recommendation.safeParse({
      id: UUID,
      sessionId: UUID2,
      verdict: "MAYBE",
      argumentAcceptability: {},
      orientationText: "",
      vetosTriggered: [],
      generatedAt: new Date(),
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a valid argument", () => {
    const ok = Argument.safeParse({
      id: UUID,
      recommendationId: UUID2,
      dimension: "TECHNICAL_JUSTIFICATION",
      grounds: [UUID],
      warrant: "w",
      backingChunkIds: [UUID2],
      claim: "c",
      acceptability: "ACCEPTED",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an argument with invalid acceptability", () => {
    const bad = Argument.safeParse({
      id: UUID,
      recommendationId: UUID2,
      dimension: "TECHNICAL_JUSTIFICATION",
      grounds: [],
      warrant: "w",
      backingChunkIds: [],
      claim: "c",
      acceptability: "MAYBE",
    });
    expect(bad.success).toBe(false);
  });
});
