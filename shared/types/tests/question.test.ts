import { describe, expect, it } from "vitest";
import {
  Answer,
  ElicitationResult,
  QuestionGuard,
  QuestionInstance,
  QuestionTemplate,
  QuestionTemplateEdge,
} from "../src/question.js";

const UUID = "00000000-0000-0000-0000-000000000020";
const UUID2 = "00000000-0000-0000-0000-000000000021";

describe("QuestionTemplate", () => {
  it("accepts a valid template", () => {
    const ok = QuestionTemplate.safeParse({
      id: "Q1",
      domainConfigId: UUID,
      dimension: "TECHNICAL_JUSTIFICATION",
      targetProfiles: ["MANAGER"],
      textPt: "pt",
      textEn: "en",
      textByProfile: { MANAGER: { pt: "pt", en: "en" } },
      inputType: "BOOLEAN",
      isCriticalForArgument: true,
      isEntryNode: true,
    });
    expect(ok.success).toBe(true);
  });
  it("rejects bad inputType", () => {
    const bad = QuestionTemplate.safeParse({
      id: "Q1",
      domainConfigId: UUID,
      dimension: "TECHNICAL_JUSTIFICATION",
      targetProfiles: [],
      textPt: "",
      textEn: "",
      textByProfile: {},
      inputType: "RADIO",
      isCriticalForArgument: true,
      isEntryNode: false,
    });
    expect(bad.success).toBe(false);
  });
});

describe("QuestionTemplateEdge & QuestionGuard", () => {
  it("accepts edge with guard", () => {
    const guardOk = QuestionGuard.safeParse({
      questionTemplateId: "Q1",
      operator: "equals",
      value: "true",
    });
    expect(guardOk.success).toBe(true);
    const edgeOk = QuestionTemplateEdge.safeParse({
      id: UUID,
      sourceTemplateId: "Q1",
      targetTemplateId: "Q2",
      dimension: "TECHNICAL_JUSTIFICATION",
      guard: {
        questionTemplateId: "Q1",
        operator: "equals",
        value: "true",
      },
    });
    expect(edgeOk.success).toBe(true);
  });
  it("rejects edge with invalid guard operator", () => {
    const bad = QuestionTemplateEdge.safeParse({
      id: UUID,
      sourceTemplateId: "Q1",
      targetTemplateId: "Q2",
      dimension: "TECHNICAL_JUSTIFICATION",
      guard: {
        questionTemplateId: "Q1",
        operator: "matches",
        value: "x",
      },
    });
    expect(bad.success).toBe(false);
  });
});

describe("QuestionInstance & Answer & ElicitationResult", () => {
  it("accepts a valid question instance and answer", () => {
    const inst = QuestionInstance.safeParse({
      id: UUID,
      sessionId: UUID2,
      generatedByLLM: false,
      textShown: "x",
      dimension: "TECHNICAL_JUSTIFICATION",
      inputType: "BOOLEAN",
      status: "PENDING",
      order: 0,
      createdAt: new Date(),
    });
    expect(inst.success).toBe(true);

    const ans = Answer.safeParse({
      id: UUID,
      sessionId: UUID2,
      questionInstanceId: UUID,
      collaboratorId: UUID2,
      value: "true",
      confidence: "CERTAIN",
      epistemicConfidence: 0.8,
      answeredAt: new Date(),
      source: "MANUAL",
      generatedByLLM: false,
    });
    expect(ans.success).toBe(true);
  });

  it("rejects an answer with invalid confidence", () => {
    const bad = Answer.safeParse({
      id: UUID,
      sessionId: UUID2,
      questionInstanceId: UUID,
      collaboratorId: UUID2,
      value: "true",
      confidence: "MAYBE",
      epistemicConfidence: 0.8,
      answeredAt: new Date(),
      source: "MANUAL",
      generatedByLLM: false,
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a valid ElicitationResult", () => {
    const ok = ElicitationResult.safeParse({
      sessionId: UUID,
      sufficiencyCriteriaMet: true,
      answers: [
        {
          questionInstanceId: UUID,
          collaboratorId: UUID2,
          dimension: "TECHNICAL_JUSTIFICATION",
          value: "x",
          confidence: "CERTAIN",
          epistemicConfidence: 0.5,
          source: "MANUAL",
          generatedByLLM: false,
        },
      ],
    });
    expect(ok.success).toBe(true);
  });
});
