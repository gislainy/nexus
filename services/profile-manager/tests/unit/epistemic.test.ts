import { describe, it, expect } from "vitest";
import { calculateEpistemicConfidence } from "@nexus/types";

describe("calculateEpistemicConfidence", () => {
  it("MANAGER + REGULATORY_COMPLIANCE + CERTAIN = 0.9", () => {
    expect(
      calculateEpistemicConfidence("MANAGER", "REGULATORY_COMPLIANCE", "CERTAIN"),
    ).toBe(0.9);
  });

  it("MANAGER + TECHNICAL_JUSTIFICATION + CERTAIN = 0.4", () => {
    expect(
      calculateEpistemicConfidence(
        "MANAGER",
        "TECHNICAL_JUSTIFICATION",
        "CERTAIN",
      ),
    ).toBe(0.4);
  });

  it("ARCHITECT + TECHNICAL_JUSTIFICATION + UNCERTAIN = 0.45", () => {
    expect(
      calculateEpistemicConfidence(
        "ARCHITECT",
        "TECHNICAL_JUSTIFICATION",
        "UNCERTAIN",
      ),
    ).toBeCloseTo(0.45);
  });

  it("DEVELOPER + IMPLEMENTATION_CAPACITY + CERTAIN = 0.9", () => {
    expect(
      calculateEpistemicConfidence(
        "DEVELOPER",
        "IMPLEMENTATION_CAPACITY",
        "CERTAIN",
      ),
    ).toBe(0.9);
  });

  it("any profile + any dimension + DELEGATED = 0.0", () => {
    expect(
      calculateEpistemicConfidence("REGULATORY", "PRIVACY_MECHANISMS", "DELEGATED"),
    ).toBe(0.0);
    expect(
      calculateEpistemicConfidence("CLINICAL", "CONSENSUS_ADEQUACY", "DELEGATED"),
    ).toBe(0.0);
  });
});
