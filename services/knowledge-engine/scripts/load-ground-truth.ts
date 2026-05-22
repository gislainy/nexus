#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const PairSchema = z.object({
  queryText: z.string().min(1),
  tag: z.string().optional(),
  relevantChunkIds: z.array(z.string().min(1)).min(1),
  notes: z.string().optional(),
});

const FileSchema = z.object({
  version: z.string().min(1),
  description: z.string(),
  pairs: z.array(PairSchema).min(1),
});

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { file: { type: "string" } },
    allowPositionals: false,
  });
  if (!values.file) {
    console.error("usage: load-ground-truth --file <path-to-json>");
    return 2;
  }

  const raw = JSON.parse(readFileSync(values.file, "utf-8"));
  const parsed = FileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("invalid ground truth file:", parsed.error.issues);
    return 2;
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();

    const allChunkIds = Array.from(
      new Set(parsed.data.pairs.flatMap((p) => p.relevantChunkIds)),
    );
    const found = await prisma.knowledgeChunk.findMany({
      where: { id: { in: allChunkIds } },
      select: { id: true },
    });
    const foundSet = new Set(found.map((c) => c.id));
    const missing = allChunkIds.filter((id) => !foundSet.has(id));
    if (missing.length > 0) {
      console.error(`missing chunk ids: ${missing.join(", ")}`);
      return 1;
    }

    const gt = await prisma.iRGroundTruth.create({
      data: {
        version: parsed.data.version,
        description: parsed.data.description,
        pairs: {
          create: parsed.data.pairs.map((p) => ({
            queryText: p.queryText,
            tag: p.tag,
            relevantChunkIds: p.relevantChunkIds,
            notes: p.notes,
          })),
        },
      },
    });

    console.log(`ground truth created: id=${gt.id} version=${gt.version} pairs=${parsed.data.pairs.length}`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
