#!/usr/bin/env node
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      version: { type: "string" },
      description: { type: "string" },
    },
    allowPositionals: false,
  });

  if (!values.version || !values.description) {
    console.error("Usage: create-snapshot --version <v> --description <d>");
    return 1;
  }

  const version = values.version as string;
  const description = values.description as string;
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.knowledgeBaseSnapshot.findUnique({
      where: { version },
    });
    if (existing) {
      console.error(`Version already exists: ${version}`);
      return 1;
    }

    const chunks = await prisma.knowledgeChunk.findMany({
      where: { status: "active" },
      select: { id: true, layer: true },
    });

    const chunkIds = chunks.map((c) => c.id);
    const coreCount = chunks.filter((c) => c.layer === "core").length;
    const expandedCount = chunks.filter((c) => c.layer === "expanded").length;

    const snapshot = await prisma.knowledgeBaseSnapshot.create({
      data: { version, description, chunkIds, coreCount, expandedCount },
    });

    console.log(`Snapshot ${version} created`);
    console.log(`Core chunks:     ${coreCount}`);
    console.log(`Expanded chunks: ${expandedCount}`);
    console.log(`Total:           ${chunkIds.length}`);
    console.log(`ID: ${snapshot.id}`);
    return 0;
  } catch (err) {
    console.error("Snapshot creation failed:", (err as Error).message);
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
