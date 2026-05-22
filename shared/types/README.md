# @nexus/types

Shared package for the Nexus monorepo. Centralizes:

- Zod schemas and inferred TypeScript types for every domain entity in the Nexus data model.
- The `LLMProvider` abstraction with `Ollama` and `OpenAI` adapters and a `createLLMProvider` factory.
- The `BenchmarkRecorder` proxy that transparently logs every `complete()` and `embed()` call as an `LLMBenchmarkRecord`.
- The Prisma schema (`prisma/schema.prisma`) that the migrations and the Prisma client are generated from. All services read and write the same database described here.
- The seed script (`prisma/seed.ts`) that populates the reference `blockchain-in-health` `DomainConfig`.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm test` | Vitest schema and recorder unit tests (no database required). |
| `pnpm build` | Type-checks and emits `dist/`. |
| `pnpm db:migrate` | Applies pending Prisma migrations against `DATABASE_URL`. |
| `pnpm db:seed` | Idempotently inserts the `blockchain-in-health` domain configuration. |
| `pnpm prisma:generate` | Generates the Prisma client. |

Copy `.env.example` to `.env` before running anything that touches the database.
