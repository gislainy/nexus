# CLAUDE.md — Nexus Repository Guide

This file provides context for working in this repository.

---

## Project Overview

Nexus is a knowledge-graph-based expert system for supporting blockchain adoption decisions in digital health projects. It is structured as independent microservices in a pnpm monorepo.

**Research context:** PhD thesis on blockchain adoption complexity in digital health. The system is the technical contribution that grounds four academic papers.

---

## Repository Structure

```
nexus/
├── services/
│   ├── domain-configurator/    # C0 — port 8001 — offline domain config
│   ├── profile-manager/        # C1 — port 8002 — project and collaborator management
│   ├── question-engine/        # C3 — port 8003 — EFSM-based adaptive questioning
│   ├── knowledge-engine/       # C4 — port 8004 — RAG pipeline over curated literature
│   └── argumentation-engine/   # C5 — port 8005 — defeasible argumentation
├── shared/
│   └── types/                  # Zod schemas shared across services
├── benchmark/
│   ├── experiments/            # BenchmarkExperiment definitions
│   ├── runners/                # Execution scripts
│   ├── results/                # Output data (gitignored)
│   └── reports/                # Analysis reports for papers
├── infra/
│   ├── docker-compose.yml      # PostgreSQL + pgvector + MinIO
│   ├── docker-compose.test.yml # Lightweight stack for CI/integration tests
│   └── python-bridge/          # port 8009 — Python interop (spaCy, scikit-learn)
├── scripts/
│   └── manual-tests/           # Human-only scripts (not run by agents or CI)
├── docs/
│   └── architecture.md
├── .github/
│   ├── workflows/              # CI per service
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── CONTRIBUTING.md
├── CLAUDE.md                   # This file
└── pnpm-workspace.yaml
```

---

## Service Structure (each service follows this pattern)

```
services/<service-name>/
├── src/
│   ├── routes/         # Fastify route handlers
│   ├── services/       # Business logic
│   ├── repositories/   # Database access (Prisma)
│   └── index.ts        # Entry point
├── tests/
│   ├── unit/           # No DB, pure logic
│   └── integration/    # Real DB via Docker
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 LTS |
| Language | TypeScript 5.x (strict mode) |
| HTTP Framework | Fastify 5.x |
| ORM | Prisma 6.x |
| Database | PostgreSQL 16 + pgvector |
| Schema validation | Zod 3.x |
| State machine (C3) | XState v5 |
| Test runner | Vitest |
| Package manager | pnpm 9.x (workspaces) |
| Infrastructure | Docker Compose |

---

## Branch Naming

All work is done on feature branches. Never commit directly to `main`.

```
feat/<service>-<short-description>    # new feature
fix/<service>-<short-description>     # bug fix
test/<service>-<short-description>    # adding tests
chore/<short-description>             # infra, tooling, config
docs/<short-description>              # documentation only
```

Examples:
```
feat/c4-vector-search-endpoint
fix/c1-profile-detection-edge-case
chore/repo-config
test/c3-efsm-guard-conditions
```

---

## Commit Messages — Conventional Commits

Format: `type(scope): short description`

```
feat(c4): add pgvector similarity search with threshold filtering
fix(c1): resolve missing field in profile detection fallback
test(c3): add unit tests for EFSM guard conditions
chore(infra): add healthchecks to docker-compose services
docs(architecture): add C4 component diagram
```

**Types:** `feat`, `fix`, `test`, `chore`, `docs`, `refactor`, `perf`
**Scopes:** `c0`, `c1`, `c3`, `c4`, `c5`, `infra`, `shared`, `benchmark`

Commit messages are validated automatically via commitlint on every commit.

---

## Pull Request Rules

- Every change goes through a PR — no direct pushes to `main`
- CI must pass before merge (tests green, TypeScript compiles, lint passes)
- PR title follows the same Conventional Commits format
- Fill the PR template completely

---

## Testing Requirements

Each service has two test layers:

**Unit tests** (`tests/unit/`): pure logic, no DB, no network. Run with `pnpm test:unit`.

**Integration tests** (`tests/integration/`): real PostgreSQL via Docker. Run with `pnpm test:integration`. These run in CI using GitHub Actions `services:` with `pgvector/pgvector:pg16`.

A PR may not be merged if:
- Any unit test fails
- Any integration test fails
- TypeScript compilation fails (`tsc --noEmit`)
- ESLint reports errors

---

## Running Locally

```bash
# Prerequisites: Docker, Node.js 22, pnpm 9

# 1. Install dependencies
pnpm install

# 2. Start infrastructure
docker compose -f infra/docker-compose.yml up -d

# 3. Copy and fill env files
cp services/knowledge-engine/.env.example services/knowledge-engine/.env
# ... repeat for each service

# 4. Run migrations
pnpm --filter knowledge-engine db:migrate

# 5. Run tests for a specific service
pnpm --filter knowledge-engine test

# 6. Run all tests
pnpm test
```

---

## Manual Testing (Human-Only)

Scripts in `scripts/manual-tests/` are run by the researcher, not by agents. They are not part of the CI pipeline.

### Seed the knowledge base with real papers

**Prerequisites:**
- `pdftotext` installed (`brew install poppler` on macOS, `sudo apt-get install poppler-utils` on Ubuntu)
- Infrastructure running: `docker compose -f infra/docker-compose.yml up -d`
- Ollama running: `ollama serve`
- Knowledge engine running: `pnpm --filter knowledge-engine dev`

**Run from the `nexus/` root:**

```bash
bash scripts/manual-tests/seed-papers.sh <path-to-nexus-knowledge-base>
```

Example (when `nexus-knowledge-base/` sits next to `nexus/`):

```bash
bash scripts/manual-tests/seed-papers.sh ../nexus-knowledge-base
```

The script indexes two core papers — Wüst & Gervais (2018) and Türkeli (2025) — extracts text from their PDFs, computes SHA-256 hashes, and confirms insertion in the database. Re-running the script is safe: the indexing pipeline is idempotent by `pdfHash`.

---

## What NOT to Do

- Do not commit secrets, API keys, or `.env` files
- Do not commit directly to `main`
- Do not merge a PR with failing CI
- Do not add `console.log` in production code (use the logger)
- Do not skip tests to make CI pass
- Do not add `any` types in TypeScript without a comment explaining why
- Do not add dependencies to `shared/` without discussing the impact on all services
