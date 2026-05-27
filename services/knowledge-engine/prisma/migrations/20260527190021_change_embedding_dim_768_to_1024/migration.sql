-- Switch embedding column to gte-large-en-v1.5 (1024 dims)
SET LOCAL search_path TO knowledge_engine, public;

DROP INDEX IF EXISTS knowledge_chunk_embedding_idx;

ALTER TABLE "KnowledgeChunk" DROP COLUMN "embedding";
ALTER TABLE "KnowledgeChunk" ADD COLUMN "embedding" public.vector(1024);

CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_idx
  ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
