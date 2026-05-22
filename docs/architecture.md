# Nexus — Architecture Overview

Nexus is a microservice system organized as a pnpm monorepo. Every service runs
as an independent Node.js process and connects to a shared PostgreSQL database
(with the `pgvector` extension) and a MinIO object store.

## Services

| Component | Service folder | Port | Responsibility |
|---|---|---|---|
| C0 | `services/domain-configurator` | 8001 | Offline domain configuration (DomainConfig, dimensions, vetos, warrants, question catalog). |
| C1 | `services/profile-manager` | 8002 | Project and collaborator management; profile identification and confidence scoring. |
| C2 | `services/artifact-analyzer` | 8002 (CLI/internal) | Extracts `ArtifactVariable` values from Git repositories and uploaded artifacts. |
| C3 | `services/question-engine` | 8003 | XState v5 EFSM that drives adaptive elicitation over `QuestionTemplate` and `QuestionTemplateEdge`. |
| C4 | `services/knowledge-engine` | 8004 | RAG pipeline over a curated literature corpus; exposes `POST /retrieve` and `GET /chunks/:id`. |
| C5 | `services/argumentation-engine` | 8005 | Defeasible argumentation (Toulmin + Dung) producing `Recommendation` and `Argument` records. |

## Data flow

```
C1 (SessionContext)  ──►  C3 (EFSM)  ──►  C5 (Argumentation)  ──►  Recommendation
                                                ▲
                                                │ RetrievalResponse
                                                │
                                            C4 (RAG, pgvector)
```

1. **C1 → C3:** C1 issues a `SessionContext` (project, session, collaborator, profile, locale).
2. **C2 → C3:** C2 pushes `ArtifactExtraction[]` so the EFSM can pre-fill answers traceable to source files.
3. **C3 → C5:** When sufficiency is met, C3 projects the session as an `ElicitationResult`.
4. **C5 → C4:** For each dimension, C5 calls `POST /retrieve` with a query and tag.
5. **C4 → C5:** C4 returns `RetrievalResponse { hasEvidence, passages[] }`. C5 builds the Argument grounded in `Answer` and backed by `chunkId[]` from C4.
6. **C5 → API:** C5 persists `Recommendation` and `Argument` and returns the payload to the API gateway.

## Stack rationale

| Choice | Why |
|---|---|
| TypeScript + Node 22 | Researcher's primary language with static contracts between services. |
| Fastify | Low overhead HTTP framework with first-class Zod schema integration. |
| Prisma | Typed ORM with generated migrations targeting a shared PostgreSQL schema. |
| PostgreSQL 16 + pgvector | Relational data and embedding vectors live in the same database. |
| MinIO | S3-compatible object store that runs locally via Docker Compose for full reproducibility. |
| Zod | Single source of truth for runtime validation and inferred TypeScript types in `@nexus/types`. |
| XState v5 | Serializable EFSM with snapshot persistence for resumable elicitation sessions. |
| Vitest | Fast Vitest runner with native TypeScript and ESM support. |
| Docker Compose | Reproducible local infrastructure (Postgres + MinIO) for every contributor. |
| Pluggable `LLMProvider` | Ollama for open/local models; OpenAI for proprietary baseline; every call recorded by `BenchmarkRecorder` for the papers. |

## Persistence

PostgreSQL is shared by every service via `DATABASE_URL`. The schema is owned by
`shared/types/prisma/schema.prisma` and generated into `@prisma/client`. The
seed in `shared/types/prisma/seed.ts` provisions the reference
`blockchain-in-health` `DomainConfig`.
