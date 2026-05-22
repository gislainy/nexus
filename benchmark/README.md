# benchmark

Workspace placeholder for the comparative benchmark infrastructure described in
`brain/ia/modelagem-nexus/implementacao/benchmark-infra.md`.

This package will host:

- `experiments/` — versioned `BenchmarkExperiment` definitions.
- `runners/` — scripts that execute each candidate model against the test prompts.
- `results/` — raw output (git-ignored).
- `reports/` — committed analyses for the papers.

It exists today so the pnpm workspace resolves. Real content lands with the
benchmark task.
