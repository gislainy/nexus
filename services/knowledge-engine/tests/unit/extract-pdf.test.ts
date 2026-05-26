import { describe, expect, it } from "vitest";
import { cleanExtractedText } from "../../scripts/extract-pdf.js";

describe("cleanExtractedText", () => {
  it("removes lines shorter than 20 chars", () => {
    const input = `${"H".repeat(25)}\n42\n${"W".repeat(25)}`;
    const output = cleanExtractedText(input);
    expect(output).toBe(`${"H".repeat(25)}\n${"W".repeat(25)}`);
  });

  it("removes line-break hyphenation between long lines", () => {
    const left = `aaaaaaaaaaaaaaaaaaaapro`;
    const right = `cessbbbbbbbbbbbbbbbbbbbb`;
    const input = `${left}-\n${right}`;
    const output = cleanExtractedText(input);
    expect(output).toContain("process");
    expect(output).not.toContain("pro-");
  });

  it("collapses runs of empty lines between content", () => {
    const a = "a".repeat(25);
    const b = "b".repeat(25);
    const input = `${a}\n\n\n\n${b}`;
    const output = cleanExtractedText(input);
    expect(output).toBe(`${a}\n${b}`);
    expect(output).not.toMatch(/\n{3,}/);
  });

  it("removes standalone page-number lines", () => {
    const a = "a".repeat(25);
    const b = "b".repeat(25);
    const padded = "  42  ";
    const input = `${a}\n${padded}\n${b}\n- 7 -`;
    const output = cleanExtractedText(input);
    expect(output).not.toMatch(/\b42\b/);
    expect(output).not.toMatch(/- 7 -/);
    expect(output).toContain(a);
    expect(output).toContain(b);
  });
});
