#!/usr/bin/env node
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      yes: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (!values.yes) {
    console.error(
      "Refusing to wipe knowledge base without --yes. This deletes all KnowledgeChunk, Paper, and KnowledgeBaseSnapshot rows.",
    );
    return 1;
  }

  const prisma = new PrismaClient();
  try {
    const chunks = await prisma.knowledgeChunk.deleteMany({});
    const papers = await prisma.paper.deleteMany({});
    const snapshots = await prisma.knowledgeBaseSnapshot.deleteMany({});
    console.log(
      `Deleted ${chunks.count} chunks, ${papers.count} papers, ${snapshots.count} snapshots.`,
    );
    return 0;
  } catch (err) {
    console.error("Reset failed:", (err as Error).message);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
