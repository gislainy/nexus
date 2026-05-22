-- Align embedding column with nomic-embed-text (768 dims)
SET LOCAL search_path TO knowledge_engine, public;

DROP INDEX IF EXISTS knowledge_chunk_embedding_idx;

ALTER TABLE "KnowledgeChunk"
  ALTER COLUMN "embedding" TYPE public.vector(768) USING NULL;

CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_idx
  ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);
