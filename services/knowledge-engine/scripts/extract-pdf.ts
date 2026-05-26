#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { PDFParse } from "pdf-parse";

export function cleanExtractedText(raw: string): string {
  let text = raw;
  text = text
    .split("\n")
    .filter((line) => line.trim().length >= 20)
    .join("\n");
  text = text.replace(/(\w)-\n(\w)/g, "$1$2");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text
    .split("\n")
    .filter((line) => !/^\s*[-–]?\s*\d+\s*[-–]?\s*$/.test(line))
    .join("\n");
  return text;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      pdf: { type: "string" },
      out: { type: "string" },
    },
    allowPositionals: false,
  });

  if (!values.pdf || !values.out) {
    console.error("Usage: extract-pdf --pdf <path.pdf> --out <path.txt>");
    return 1;
  }

  const pdfPath = values.pdf as string;
  const outPath = values.out as string;

  if (!existsSync(pdfPath)) {
    console.error(`File not found: ${pdfPath}`);
    return 1;
  }

  try {
    const buffer = readFileSync(pdfPath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    const cleaned = cleanExtractedText(result.text);
    writeFileSync(outPath, cleaned, "utf8");
    console.log(`Extracted ${cleaned.length} chars from ${pdfPath}`);
    console.log(`Saved to ${outPath}`);
    return 0;
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }
}

const invokedDirectly =
  process.argv[1]?.endsWith("extract-pdf.ts") ||
  process.argv[1]?.endsWith("extract-pdf.js");

if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
