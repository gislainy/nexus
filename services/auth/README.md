# Auth Service

Identity and authentication for Nexus. Owns the `User` entity, issues signed JWT
access tokens and persisted refresh tokens. Every protected screen in `apps/web/`
depends on this service.

- **Port:** 8000
- **Stack:** Fastify + Prisma + bcryptjs + jsonwebtoken

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create an account, returns access + refresh tokens |
| `POST` | `/auth/login` | Authenticate with email and password |
| `POST` | `/auth/refresh` | Issue a new access token from a refresh token |
| `GET` | `/auth/me` | Return the authenticated user (Bearer token) |
| `GET` | `/health` | Liveness probe |

## Running locally

```bash
cp .env.example .env   # fill JWT_SECRET
pnpm --filter auth db:generate
pnpm --filter auth dev
```

## Tests

```bash
pnpm --filter auth test:unit
pnpm --filter auth test:integration   # requires a running PostgreSQL (see infra/)
```

`JWT_SECRET` has no default — the service refuses to start without it.
