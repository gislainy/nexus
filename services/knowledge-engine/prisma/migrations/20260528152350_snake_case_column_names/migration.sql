-- Rename all multi-word columns and all tables in the knowledge_engine schema
-- to snake_case. Uses ALTER TABLE ... RENAME to preserve existing data.
-- Constraint/index renames are appended below to match Prisma's convention.

-- Paper -> paper
ALTER TABLE "Paper" RENAME COLUMN "submodulePath" TO "submodule_path";
ALTER TABLE "Paper" RENAME COLUMN "pdfHash" TO "pdf_hash";
ALTER TABLE "Paper" RENAME COLUMN "accessType" TO "access_type";
ALTER TABLE "Paper" RENAME COLUMN "indexedAt" TO "indexed_at";
ALTER TABLE "Paper" RENAME TO "paper";

-- KnowledgeChunk -> knowledge_chunk
ALTER TABLE "KnowledgeChunk" RENAME COLUMN "paperId" TO "paper_id";
ALTER TABLE "KnowledgeChunk" RENAME COLUMN "pageRef" TO "page_ref";
ALTER TABLE "KnowledgeChunk" RENAME COLUMN "accessType" TO "access_type";
ALTER TABLE "KnowledgeChunk" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "KnowledgeChunk" RENAME TO "knowledge_chunk";

-- KnowledgeBaseSnapshot -> knowledge_base_snapshot
ALTER TABLE "KnowledgeBaseSnapshot" RENAME COLUMN "chunkIds" TO "chunk_ids";
ALTER TABLE "KnowledgeBaseSnapshot" RENAME COLUMN "coreCount" TO "core_count";
ALTER TABLE "KnowledgeBaseSnapshot" RENAME COLUMN "expandedCount" TO "expanded_count";
ALTER TABLE "KnowledgeBaseSnapshot" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "KnowledgeBaseSnapshot" RENAME TO "knowledge_base_snapshot";

-- IRGroundTruth -> ir_ground_truth
ALTER TABLE "IRGroundTruth" RENAME TO "ir_ground_truth";

-- IRGroundTruthPair -> ir_ground_truth_pair
ALTER TABLE "IRGroundTruthPair" RENAME COLUMN "groundTruthId" TO "ground_truth_id";
ALTER TABLE "IRGroundTruthPair" RENAME COLUMN "queryText" TO "query_text";
ALTER TABLE "IRGroundTruthPair" RENAME COLUMN "relevantChunkIds" TO "relevant_chunk_ids";
ALTER TABLE "IRGroundTruthPair" RENAME TO "ir_ground_truth_pair";

-- IRBenchmarkExperiment -> ir_benchmark_experiment
ALTER TABLE "IRBenchmarkExperiment" RENAME COLUMN "experimentType" TO "experiment_type";
ALTER TABLE "IRBenchmarkExperiment" RENAME COLUMN "groundTruthId" TO "ground_truth_id";
ALTER TABLE "IRBenchmarkExperiment" RENAME COLUMN "winnerCandidate" TO "winner_candidate";
ALTER TABLE "IRBenchmarkExperiment" RENAME COLUMN "decisionRationale" TO "decision_rationale";
ALTER TABLE "IRBenchmarkExperiment" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "IRBenchmarkExperiment" RENAME COLUMN "completedAt" TO "completed_at";
ALTER TABLE "IRBenchmarkExperiment" RENAME TO "ir_benchmark_experiment";

-- IRBenchmarkResult -> ir_benchmark_result
ALTER TABLE "IRBenchmarkResult" RENAME COLUMN "experimentId" TO "experiment_id";
ALTER TABLE "IRBenchmarkResult" RENAME COLUMN "candidateId" TO "candidate_id";
ALTER TABLE "IRBenchmarkResult" RENAME COLUMN "rrfK" TO "rrf_k";
ALTER TABLE "IRBenchmarkResult" RENAME COLUMN "recallAt10" TO "recall_at10";
ALTER TABLE "IRBenchmarkResult" RENAME COLUMN "ndcgAt10" TO "ndcg_at10";
ALTER TABLE "IRBenchmarkResult" RENAME COLUMN "indexingLatencyMs" TO "indexing_latency_ms";
ALTER TABLE "IRBenchmarkResult" RENAME COLUMN "queryLatencyMs" TO "query_latency_ms";
ALTER TABLE "IRBenchmarkResult" RENAME COLUMN "byTag" TO "by_tag";
ALTER TABLE "IRBenchmarkResult" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "IRBenchmarkResult" RENAME TO "ir_benchmark_result";

-- Rename PK/FK constraints and indexes to match snake_case convention
-- AlterTable
ALTER TABLE "ir_benchmark_experiment" RENAME CONSTRAINT "IRBenchmarkExperiment_pkey" TO "ir_benchmark_experiment_pkey";
-- AlterTable
ALTER TABLE "ir_benchmark_result" RENAME CONSTRAINT "IRBenchmarkResult_pkey" TO "ir_benchmark_result_pkey";
-- AlterTable
ALTER TABLE "ir_ground_truth" RENAME CONSTRAINT "IRGroundTruth_pkey" TO "ir_ground_truth_pkey";
-- AlterTable
ALTER TABLE "ir_ground_truth_pair" RENAME CONSTRAINT "IRGroundTruthPair_pkey" TO "ir_ground_truth_pair_pkey";
-- AlterTable
ALTER TABLE "knowledge_base_snapshot" RENAME CONSTRAINT "KnowledgeBaseSnapshot_pkey" TO "knowledge_base_snapshot_pkey";
-- AlterTable
ALTER TABLE "knowledge_chunk" RENAME CONSTRAINT "KnowledgeChunk_pkey" TO "knowledge_chunk_pkey";
-- AlterTable
ALTER TABLE "paper" RENAME CONSTRAINT "Paper_pkey" TO "paper_pkey";
-- RenameForeignKey
ALTER TABLE "ir_benchmark_experiment" RENAME CONSTRAINT "IRBenchmarkExperiment_groundTruthId_fkey" TO "ir_benchmark_experiment_ground_truth_id_fkey";
-- RenameForeignKey
ALTER TABLE "ir_benchmark_result" RENAME CONSTRAINT "IRBenchmarkResult_experimentId_fkey" TO "ir_benchmark_result_experiment_id_fkey";
-- RenameForeignKey
ALTER TABLE "ir_ground_truth_pair" RENAME CONSTRAINT "IRGroundTruthPair_groundTruthId_fkey" TO "ir_ground_truth_pair_ground_truth_id_fkey";
-- RenameForeignKey
ALTER TABLE "knowledge_chunk" RENAME CONSTRAINT "KnowledgeChunk_paperId_fkey" TO "knowledge_chunk_paper_id_fkey";
-- RenameIndex
ALTER INDEX "IRGroundTruth_version_key" RENAME TO "ir_ground_truth_version_key";
-- RenameIndex
ALTER INDEX "KnowledgeBaseSnapshot_version_key" RENAME TO "knowledge_base_snapshot_version_key";
