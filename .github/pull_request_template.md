## What this PR does

<!-- One sentence describing the change -->

## Related service

<!-- Which component does this affect? -->
- [ ] C0 — domain-configurator
- [ ] C1 — profile-manager
- [ ] C3 — question-engine
- [ ] C4 — knowledge-engine
- [ ] C5 — argumentation-engine
- [ ] shared/types
- [ ] infra
- [ ] benchmark
- [ ] docs / ci

## Changes

<!-- Brief list of what was added, changed, or removed -->

## How to test

<!-- Steps to verify the changes work correctly -->

```bash
# example:
pnpm --filter knowledge-engine test:integration
```

## Checklist

- [ ] Tests pass locally (`pnpm test`)
- [ ] TypeScript compiles without errors (`tsc --noEmit`)
- [ ] No `console.log` left in production code
- [ ] No secrets or `.env` files committed
- [ ] PR title follows Conventional Commits format
