import { describe, expect, it } from "vitest";
import {
  ArtifactVariable,
  ConflictDefinition,
  DimensionDefinition,
  DomainConfig,
  EvaluationRule,
  ProfileDefinition,
  VetoDefinition,
  WarrantDefinition,
} from "../src/domain.js";

const DOMAIN_ID = "00000000-0000-0000-0000-000000000001";

describe("DomainConfig schema", () => {
  it("accepts a valid domain", () => {
    const ok = DomainConfig.safeParse({
      id: DOMAIN_ID,
      domainName: "blockchain-in-health",
      domainVersion: "1.0.0",
      description: "test",
      technology: "blockchain",
      tagSet: ["a"],
      active: true,
      createdAt: new Date(),
      approvedBy: "G",
      approvedAt: new Date(),
    });
    expect(ok.success).toBe(true);
  });
  it("rejects empty tagSet", () => {
    const bad = DomainConfig.safeParse({
      id: DOMAIN_ID,
      domainName: "x",
      domainVersion: "1",
      description: "",
      tagSet: [],
      createdAt: new Date(),
      approvedBy: "G",
      approvedAt: new Date(),
    });
    expect(bad.success).toBe(false);
  });
});

describe("DimensionDefinition / ProfileDefinition / ArtifactVariable", () => {
  it("accepts valid dimension and rejects missing tag", () => {
    expect(
      DimensionDefinition.safeParse({
        id: "TECH",
        domainConfigId: DOMAIN_ID,
        name: "Tech",
        description: "d",
        tag: "tech",
      }).success,
    ).toBe(true);
    expect(
      DimensionDefinition.safeParse({
        id: "TECH",
        domainConfigId: DOMAIN_ID,
        name: "Tech",
        description: "d",
        tag: "",
      }).success,
    ).toBe(false);
  });

  it("accepts valid profile and rejects bad technicalDepth", () => {
    expect(
      ProfileDefinition.safeParse({
        id: "MANAGER",
        domainConfigId: DOMAIN_ID,
        name: "Manager",
        description: "",
        vocabulary: [],
        technicalDepth: "LOW",
      }).success,
    ).toBe(true);
    expect(
      ProfileDefinition.safeParse({
        id: "MANAGER",
        domainConfigId: DOMAIN_ID,
        name: "Manager",
        description: "",
        vocabulary: [],
        technicalDepth: "EXPERT",
      }).success,
    ).toBe(false);
  });

  it("accepts valid artifact variable", () => {
    expect(
      ArtifactVariable.safeParse({
        id: "VAR_X",
        domainConfigId: DOMAIN_ID,
        name: "X",
        description: "",
        extractionHint: "",
        mapsToQuestionId: "Q1",
      }).success,
    ).toBe(true);
  });
});

describe("WarrantDefinition / VetoDefinition", () => {
  it("requires at least one source on warrants", () => {
    const bad = WarrantDefinition.safeParse({
      id: "W1",
      domainConfigId: DOMAIN_ID,
      dimensionId: "D1",
      structuralWarrant: "rule",
      sources: [],
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a composite evaluation rule", () => {
    const rule = {
      operator: "AND" as const,
      conditions: [
        { field: "answer.Q1.value", operator: "equals" as const, value: "true" },
        {
          operator: "OR" as const,
          conditions: [
            { field: "answer.Q2.value", operator: "equals" as const, value: "x" },
            {
              operator: "NOT" as const,
              condition: {
                field: "answer.Q3.value",
                operator: "equals" as const,
                value: "y",
              },
            },
          ],
        },
      ],
    };
    expect(EvaluationRule.safeParse(rule).success).toBe(true);

    const veto = VetoDefinition.safeParse({
      id: "V1",
      domainConfigId: DOMAIN_ID,
      condition: "cond",
      description: "d",
      evaluationRule: rule,
      remediationPath: ["step"],
      sources: ["src"],
    });
    expect(veto.success).toBe(true);
  });

  it("rejects invalid evaluation rule operator", () => {
    const bad = EvaluationRule.safeParse({
      field: "answer.Q.value",
      operator: "regex",
      value: "x",
    });
    expect(bad.success).toBe(false);
  });
});

describe("ConflictDefinition", () => {
  it("accepts a valid conflict", () => {
    const ok = ConflictDefinition.safeParse({
      id: "00000000-0000-0000-0000-000000000002",
      domainConfigId: DOMAIN_ID,
      dimensionAId: "A",
      dimensionBId: "B",
      conditionA: { field: "answer.Q.value", operator: "equals", value: "a" },
      conditionB: { field: "answer.Q.value", operator: "equals", value: "b" },
      description: "",
    });
    expect(ok.success).toBe(true);
  });
});
