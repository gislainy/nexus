import type { QuestionInputType } from "@nexus/types";
import { SCALE_CONFLICT_THRESHOLD } from "@nexus/types";
import type { ConfidentAnswer } from "../repositories/answer.repository.js";

export interface NewAnswer {
  value: string;
  inputType: QuestionInputType;
  collaboratorId: string;
  epistemicConfidence: number;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictingAnswerId?: string;
}

// Decides whether a new answer contradicts an existing high-confidence answer
// for the same question instance. The caller is responsible for filtering
// `existingAnswers` to those whose epistemic confidence exceeds the review
// threshold; this function only compares values by input type.
export function detectConflict(
  newAnswer: NewAnswer,
  existingAnswers: ConfidentAnswer[],
): ConflictResult {
  for (const existing of existingAnswers) {
    if (isConflicting(newAnswer, existing.value)) {
      return { hasConflict: true, conflictingAnswerId: existing.id };
    }
  }
  return { hasConflict: false };
}

function isConflicting(newAnswer: NewAnswer, existingValue: string): boolean {
  switch (newAnswer.inputType) {
    case "BOOLEAN":
    case "SELECT":
    case "MULTI_SELECT":
      return newAnswer.value !== existingValue;
    case "SCALE": {
      const next = parseFloat(newAnswer.value);
      const previous = parseFloat(existingValue);
      if (Number.isNaN(next) || Number.isNaN(previous)) {
        return false;
      }
      return Math.abs(next - previous) > SCALE_CONFLICT_THRESHOLD;
    }
    case "TEXT":
      // Free text cannot be compared automatically; any other confident answer
      // for the same question instance flags the need for human review.
      return true;
    default:
      return false;
  }
}
