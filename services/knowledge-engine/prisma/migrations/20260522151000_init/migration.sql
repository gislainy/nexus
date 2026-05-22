-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "knowledge_engine";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "year" INTEGER NOT NULL,
    "venue" TEXT NOT NULL,
    "doi" TEXT,
    "submodulePath" TEXT NOT NULL,
    "pdfHash" TEXT NOT NULL,
    "accessType" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "tags" TEXT[],
    "text" TEXT NOT NULL,
    "claim" TEXT,
    "embedding" public.vector(1536),
    "pageRef" TEXT,
    "layer" TEXT NOT NULL,
    "accessType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseSnapshot" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "chunkIds" TEXT[],
    "coreCount" INTEGER NOT NULL,
    "expandedCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeBaseSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IRGroundTruth" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "IRGroundTruth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IRGroundTruthPair" (
    "id" TEXT NOT NULL,
    "groundTruthId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "tag" TEXT,
    "relevantChunkIds" TEXT[],
    "notes" TEXT,

    CONSTRAINT "IRGroundTruthPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IRBenchmarkExperiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "experimentType" TEXT NOT NULL,
    "candidates" TEXT[],
    "groundTruthId" TEXT NOT NULL,
    "winnerCandidate" TEXT,
    "decisionRationale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IRBenchmarkExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IRBenchmarkResult" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "rrfK" INTEGER,
    "recallAt10" DOUBLE PRECISION NOT NULL,
    "mrr" DOUBLE PRECISION NOT NULL,
    "ndcgAt10" DOUBLE PRECISION NOT NULL,
    "indexingLatencyMs" INTEGER,
    "queryLatencyMs" INTEGER,
    "byTag" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IRBenchmarkResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBaseSnapshot_version_key" ON "KnowledgeBaseSnapshot"("version");

-- CreateIndex
CREATE UNIQUE INDEX "IRGroundTruth_version_key" ON "IRGroundTruth"("version");

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IRGroundTruthPair" ADD CONSTRAINT "IRGroundTruthPair_groundTruthId_fkey" FOREIGN KEY ("groundTruthId") REFERENCES "IRGroundTruth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IRBenchmarkExperiment" ADD CONSTRAINT "IRBenchmarkExperiment_groundTruthId_fkey" FOREIGN KEY ("groundTruthId") REFERENCES "IRGroundTruth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IRBenchmarkResult" ADD CONSTRAINT "IRBenchmarkResult_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "IRBenchmarkExperiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- HNSW index for vector similarity search (pgvector lives in public)
SET LOCAL search_path TO knowledge_engine, public;
CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_idx
  ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);
