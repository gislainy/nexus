# Nexus

Nexus is a knowledge-graph-based expert system for supporting blockchain adoption decisions in digital health projects.

It decomposes the complexity of blockchain adoption into structured dimensions, evaluates projects through a multi-stage pipeline, and produces evidence-backed recommendations tailored to each collaborator's profile.

## Architecture

Nexus is implemented as independent microservices in a pnpm monorepo:

| Service | Port | Responsibility |
|---|---|---|
| `domain-configurator` | 8001 | Offline domain configuration (C0) |
| `profile-manager` | 8002 | Project and collaborator profile management (C1) |
| `question-engine` | 8003 | EFSM-based adaptive question flow (C3) |
| `knowledge-engine` | 8004 | RAG pipeline over curated literature (C4) |
| `argumentation-engine` | 8005 | Defeasible argumentation and recommendation (C5) |

## Getting Started

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL + pgvector + MinIO)
docker compose -f infra/docker-compose.yml up -d

# Run migrations (all services)
pnpm db:migrate

# Run all tests
pnpm test
```

## Documentation

- [Architecture overview](docs/architecture.md)
- [Contributing guide](CONTRIBUTING.md)

## License

Academic research project. All rights reserved.
