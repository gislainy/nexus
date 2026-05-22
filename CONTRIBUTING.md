# Contributing to Nexus

## Branching

All work happens on feature branches. Never push directly to `main`.

**Branch naming:**
```
feat/<scope>-<description>     # new feature
fix/<scope>-<description>      # bug fix
test/<scope>-<description>     # tests only
chore/<description>            # tooling, config, infra
docs/<description>             # documentation only
refactor/<scope>-<description> # refactoring without behavior change
```

**Scopes:** `c0`, `c1`, `c3`, `c4`, `c5`, `infra`, `shared`, `benchmark`

**Examples:**
```
feat/c4-retrieval-threshold
fix/c3-efsm-guard-missing-field
chore/repo-config
test/c1-profile-detection
```

---

## Commit Messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org/).
Commit messages are validated automatically — malformed messages are rejected.

**Format:** `type(scope): short description`

```
feat(c4): add pgvector cosine similarity search
fix(c1): handle missing profile field in detection fallback
test(c3): add unit tests for EFSM guard conditions
chore(infra): add postgres healthcheck to docker-compose
docs(architecture): update component diagram with C5 data flow
refactor(c5): extract warrant evaluation to separate module
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `test` — adding or modifying tests
- `chore` — tooling, config, build, CI
- `docs` — documentation only
- `refactor` — restructuring without behavior change
- `perf` — performance improvement

---

## Pull Requests

1. Create a branch from `main`
2. Make your changes with passing tests
3. Open a PR using the provided template
4. CI must be green before merge
5. Merge via **Squash and merge** to keep history clean

**PR title** must follow the same Conventional Commits format:
```
feat(c4): add retrieval pipeline with pgvector
```

---

## Testing

Each service has unit and integration tests.

```bash
# Run unit tests (no DB required)
pnpm --filter <service-name> test:unit

# Run integration tests (requires Docker)
docker compose -f infra/docker-compose.test.yml up -d
pnpm --filter <service-name> test:integration

# Run all tests across all services
pnpm test
```

A PR will not be merged if:
- Any test fails
- TypeScript compilation fails
- ESLint reports errors

---

## Local Setup

See [README.md](README.md) for the full setup guide.

---

## Code Standards

- TypeScript strict mode — no implicit `any`
- All public functions must have JSDoc comments
- No `console.log` in production code — use the service logger
- Zod schemas for all external inputs (HTTP requests, env vars)
- Prisma for all database access — no raw SQL unless justified
