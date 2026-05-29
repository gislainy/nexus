# HTTP Flows — Usage Guide

HTTP request collections for manual and exploratory testing of Nexus services. Each folder maps to one implementation task. Each `.bru` file is one request in the test flow for that task.

---

## Initial Setup

**1. Install Bruno**
```bash
# macOS
brew install bruno

# or download at https://www.usebruno.com/downloads
```

**2. Create your local environment file**
```bash
cp nexus/http-flows/environments/local.bru.example nexus/http-flows/environments/local.bru
```

`local.bru` is not versioned (see `.gitignore`). Edit it with your local configuration:

```
vars {
  c1Url: http://localhost:8002
  c4Url: http://localhost:8004
  c3Url: http://localhost:8003
  c5Url: http://localhost:8005
  c0Url: http://localhost:8001
}
```

Adjust ports as needed. State variables (`projectId`, `sessionId`, etc.) are populated automatically by `post-response` scripts as you run the flows.

**3. Open in Bruno**

Bruno → Open Collection → select the `nexus/http-flows/` folder.

Or use the Bruno extension for VS Code (search "Bruno" in the extensions marketplace).

---

## How chained variables work

Some requests depend on variables set by previous requests. For example, `04-get-project-context.bru` uses `{{projectId}}`, which is only set when `02-create-project.bru` runs and its `post-response` script fires. Running a single file in isolation will fail if the variable has not been set yet.

**There are three ways to handle this:**

**Option A — Run the entire folder in sequence (recommended for flows)**
Click on the folder `task-001-scaffold` in Bruno's sidebar → click the **Run** button (play icon on the folder, not on a file). Bruno executes all files in order; the `post-response` script in `02` sets `projectId`, and `04` picks it up automatically.

**Option B — Run via CLI**
```bash
bru run nexus/http-flows/c1-profile-manager/task-001-scaffold --env local
```

**Option C — Set the variable manually in `local.bru` (for running individual files)**
After running `02-create-project.bru` at least once, copy the `projectId` from the response and paste it into `local.bru`:
```
vars {
  c1Url: http://localhost:8002
  projectId: 63d79a8b-e359-48b6-a043-22426aa4eaf1
  sessionId: 00ee08b2-e241-4c89-9c4f-12fa5a956cb0
}
```
After that, any individual file using `{{projectId}}` will work independently.

---

## Folder Structure

```
http-flows/
├── bruno.json                          ← collection config
├── .gitignore                          ← excludes local.bru
├── environments/
│   ├── local.bru.example               ← versioned template
│   └── local.bru                       ← NOT versioned (your local config)
└── c1-profile-manager/
    ├── task-001-scaffold/              ← implemented ✅
    ├── task-002-collaborator/
    ├── task-003-readiness/
    ├── task-004-gap-detection/
    └── task-005-collaboration/
```

When a task has not been implemented yet, the `.bru` files exist but Bruno returns `connection refused` on execution — this is expected. The flows are ready for when the endpoints exist.

---

## File Naming Convention

```
NN-descriptive-name.bru
```

- `NN` starts at `01` and defines execution order within the folder
- the name describes the request, not the expected outcome
- examples: `02-create-project.bru`, `05-get-profile-after-patch.bru`

---

## Internal Structure of Each `.bru` File

Every file follows this structure:

```
meta {
  name: <human-readable name>
  type: http
  seq: <same number as NN in filename>
}

<method> {
  url: {{c1Url}}/path
  body: json | none
  auth: none
}

body:json {       ← only if there is a request body
  {
    "field": "value"
  }
}

script:post-response {    ← only if extracting variables for the next request
  if (res.status === 201) {
    bru.setVar("projectId", res.body.projectId);
  }
}

assert {
  res.status: eq 201
  res.body.projectId: isDefined
}

docs {    ← only if the request requires a SQL precondition
  Precondition: run via psql before this request:
    UPDATE session SET status = 'SUFFICIENT' WHERE id = '<sessionId>';
}
```

**Chaining rule:** the file that extracts a variable (e.g. `02-create-project.bru` extracts `projectId`) must run before files that consume it (e.g. `04-get-project-context.bru` uses `{{projectId}}`). The numeric prefix enforces this order.

---

## Running via CLI

```bash
# Run all requests in a task folder sequentially
bru run nexus/http-flows/c1-profile-manager/task-001-scaffold \
  --env local \
  --output results.json

# Run a single file
bru run nexus/http-flows/c1-profile-manager/task-001-scaffold/02-create-project.bru \
  --env local
```

---

## Adding Flows for a New Task

1. Create the folder: `c1-profile-manager/task-NNN-name/`
2. Create one `.bru` file per request, numbered from `01`
3. The first file that creates a new resource must have a `script:post-response` to extract the ID
4. Subsequent files use `{{variable}}` to chain
5. Include at least one error case (404, 400) per new endpoint

---

## Environment Variables

### Service URLs (set manually in `local.bru`)

| Variable | Service | Default port |
|---|---|---|
| `c1Url` | profile-manager (C1) | 8002 |
| `c4Url` | knowledge-engine (C4) | 8004 |
| `c3Url` | question-engine (C3) | 8003 |
| `c5Url` | argumentation-engine (C5) | 8005 |
| `c0Url` | domain-configurator (C0) | 8001 |

### State IDs (populated automatically by `post-response` scripts)

| Variable | Set by | Used by |
|---|---|---|
| `projectId` | `task-001/02-create-project.bru` | task-001, 002, 003, 004, 005 |
| `sessionId` | `task-001/02-create-project.bru` | task-003, 004, 005 |
| `collaboratorId` | `task-002/01-add-collaborator-architect.bru` | task-002, 003, 004, 005 |
| `collaboratorId2` | `task-002/02-add-collaborator-manager.bru` | task-002 |
| `questionInstanceId` | manual (via psql) | task-004, 005 |

---

## Task Status

| Folder | Task | Status |
|---|---|---|
| `task-001-scaffold` | Service scaffold + project endpoints | ✅ implemented |
| `task-002-collaborator` | Collaborator and profile management | 🔴 pending |
| `task-003-readiness` | epistemicConfidence + evaluateReadiness | 🔴 pending |
| `task-004-gap-detection` | Gap detection + LLM interface (stub) | 🔴 pending |
| `task-005-collaboration` | Force-advance, session status, conflict detection | 🔴 pending |
