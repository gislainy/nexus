import { describe, expect, it } from "vitest";
import {
  cleanExtractedText,
  isLikelySectionHeader,
} from "../../scripts/extract-pdf.js";

describe("cleanExtractedText", () => {
  it("removes lines shorter than 20 chars", () => {
    const input = `${"H".repeat(25)}\n42\n${"W".repeat(25)}`;
    const output = cleanExtractedText(input);
    expect(output).toBe(`${"H".repeat(25)}\n${"W".repeat(25)}`);
  });

  it("preserves short section headers", () => {
    const body = "x".repeat(25);
    const input = `${body}\nIntroduction\nshort line\n2.1 Methods\nABSTRACT\n${body}`;
    const output = cleanExtractedText(input);
    expect(output).toContain("Introduction");
    expect(output).toContain("2.1 Methods");
    expect(output).toContain("ABSTRACT");
    expect(output).not.toContain("short line");
  });

  it("isLikelySectionHeader recognises common patterns", () => {
    expect(isLikelySectionHeader("Introduction")).toBe(true);
    expect(isLikelySectionHeader("3. Results")).toBe(true);
    expect(isLikelySectionHeader("4.2.1 Threats to Validity")).toBe(true);
    expect(isLikelySectionHeader("REFERENCES")).toBe(true);
    expect(isLikelySectionHeader("the quick brown fox")).toBe(false);
    expect(isLikelySectionHeader("42")).toBe(false);
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
