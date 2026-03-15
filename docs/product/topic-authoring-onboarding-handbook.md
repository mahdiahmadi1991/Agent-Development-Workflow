# Topic Authoring Onboarding Handbook (Codex Onboarding)

## 1) Purpose
This handbook is the canonical, implementation-grade guide for creating a **new onboarding topic package** that is compatible with the Codex Onboarding extension architecture.

It is intentionally written so an external AI model (without repository access) can still produce a valid topic package that can be dropped into this project with minimal adaptation.

## 2) Scope and Non-Goals
### In Scope
- Authoring one or more topic files.
- Indexing topics in `topics.index.yaml`.
- Wiring topic availability through profiles and question flow tags.
- Maintaining deterministic selection behavior.
- Producing a package that passes technical validation gates.

### Out of Scope
- Implementing VS Code extension runtime behavior.
- Changing managed-state schema.
- Changing governance hierarchy or override model.

## 3) Fixed Architecture Contracts
The following contracts are **non-negotiable** for topic authoring:

1. Topic file template contract:
- Topic files use a `comment block` metadata header.
- Topic body section order is fixed.
- One topic per file.

2. Topics index contract:
- Single source of truth for selectable topics is `topics.index.yaml`.
- Every indexed topic must exist.
- Every topic file must be indexed (no orphan topic files).

3. Selection contract:
- Resolver selects topics deterministically from:
  - profile baseline topics
  - capability tags
  - dependencies/conflicts
- Resolver reason tags (`why-selected`) must be preserved.

4. Storage contract:
- Canonical source assets are under `.codex-onboarding/library/**`.
- Extension runtime mirror (`packages/vscode-extension/onboarding-assets/**`) is generated; do not edit directly.

## 4) Required Folder Layout
Authoring target structure (canonical source):

```text
.codex-onboarding/library/
  topics/
    cross-cutting/
    dotnet/
      csharp/
        app-types/
        architecture/
        data/
        security/
        testing/
  indexes/
    topics.index.yaml
  profiles/
    <family>/
      baseline.yaml
      <profile>.yaml
  questionnaires/
    index.yaml
    <family>/
      install-flow.yaml
  rules/
    selector-rules.yaml
```

## 5) Topic File Contract (Mandatory)
Each topic file must start with metadata comment block:

```md
<!--
file_id: <unique-file-id>
category: <cross-cutting|technology-specific>
severity: <low|medium|high|critical>
required: <true|false>
applicability:
  ecosystems: []
  languages: []
  project_types: []
overridable_sections: []
bundle_id: <bundle-id>
bundle_version: <bundle-version>
extension_version: <extension-version>
sync_marker: <sync-marker>
-->
```

Then topic body with exact section order:

1. `# <Topic Title>`
2. `## Intent`
3. `## Applicability`
4. `## Mandatory Rules`
5. `## Recommended Practices`
6. `## Anti-Patterns`
7. `## AI Execution Contract`
8. `## Prompt Starters`
9. `## Validation Checklist`
10. `## Allowed Override Surface`
11. `## Change Impact Notes`

If section order is broken, topic is invalid.

## 6) Topic Metadata Semantics
### `file_id`
- Globally unique across all topics.
- Stable identifier; changing it is a breaking catalog change.
- Recommended format: `<domain>-<topic>-<purpose>` in lowercase kebab-case.

### `category`
- Semantic grouping for explainability and ordering.
- Example: `cross-cutting`, `dotnet/csharp/security`.

### `severity`
- Guidance strictness signal.
- Suggested policy:
  - `critical`: correctness/safety/security gates.
  - `high`: architecture invariants.
  - `medium`: strongly recommended defaults.
  - `low`: style/polish guidance.

### `required`
- `true`: topic is mandatory when selected through profile/index logic.
- `false`: optional topic; may be removed by conflict policy.

### `applicability`
High-level targeting metadata used by authoring governance and future filtering:
- `ecosystems` (example: `dotnet`, `frontend`).
- `languages` (example: `csharp`, `typescript`).
- `project_types` (example: `web-api`, `worker`, `ui`).

### `overridable_sections`
- Explicit list of sections the consumer is allowed to override.
- Empty list means topic is effectively immutable from override perspective.

### `bundle_*` and `sync_marker`
- Placeholders in source artifacts; installer rewrites to runtime values.
- Keep placeholders stable; do not hardcode runtime version values in source.

## 7) Topics Index Contract
Canonical file: `.codex-onboarding/library/indexes/topics.index.yaml`

Top-level keys:
- `version`
- `topics`

Each topic entry must include:
- `file_id`
- `path` (must point under `topics/`)
- `category`
- `severity`
- `required`
- `tags`
- `applicability`
- `requires`
- `conflicts_with`

Example entry:

```yaml
- file_id: dotnet-auth-guardrails
  path: topics/dotnet/csharp/security/dotnet-auth-guardrails.md
  category: 10-backend
  severity: high
  required: false
  tags: [concern.backend.auth, tech.backend.dotnet]
  applicability:
    families: [dotnet-csharp]
  requires: []
  conflicts_with: []
```

## 8) Profile Wiring Contract
Profiles define baseline topic composition and default capabilities.

Example profile:

```yaml
version: 1
profile_id: dotnet-csharp-web-api-simple
family: dotnet-csharp
inherits: dotnet-csharp-baseline
questionnaire_ref: .codex-onboarding/library/questionnaires/dotnet-csharp/install-flow.yaml
baseline_topics: [dotnet-auth-guardrails]
default_capabilities: [tech.backend.dotnet.webapi]
```

Rules:
- `baseline_topics` must reference valid `file_id` values in topics index.
- `default_capabilities` should align with questionnaire `emits.capability_tags`.
- Keep profile IDs stable and deterministic.

## 9) Questionnaire and Tag Contract
Questionnaire flow is data-driven and tree-based (`single` / `multi`, N-layer).

Use `emits` on options to push:
- `capability_tags`
- `profile_hints`
- `topic_tags`

Topic selection should be driven by meaningful tags, not hardcoded command logic.

## 10) Dependency and Conflict Design Rules
Use `requires` and `conflicts_with` conservatively:
- `requires` only for hard prerequisites.
- `conflicts_with` only for true incompatibility.
- Avoid cyclic dependencies.
- Keep optional conflicts resolvable by dropping optional topics.

## 11) Writing Quality Standard (Topic Content)
Topic content must be:
- Technology-accurate.
- Actionable for Codex behavior.
- Non-business-specific.
- Deterministic (avoid ambiguous language like “maybe usually”).
- Override-aware (identify what can be locally changed).

Avoid:
- Organization-specific policies.
- Environment secrets.
- One-off project assumptions.
- Runtime instructions that require extension code changes.

## 12) External AI Production Protocol (No Repo Access)
If an external AI model must produce a topic package:

1. Provide this handbook as the only source.
2. Provide explicit target tuple:
- family
- technology scope
- desired topic list
- intended capability tags

3. Ask the model to output:
- topic files (`*.md`) with full metadata and fixed sections.
- `topics.index.yaml` patch entries.
- profile patch snippets.
- questionnaire patch snippets (if new emits/tags required).
- a validation checklist report.

4. Before import, run human review:
- correctness review
- contract conformance review
- naming and taxonomy review

5. Import generated files into canonical source root:
- `.codex-onboarding/library/**`

6. Run synchronization:
- `npm --prefix packages/vscode-extension run sync:onboarding-assets`

7. Run validation:
- `scripts/validate-governance.sh`
- `npm --prefix packages/vscode-extension test`
- `npm --prefix packages/vscode-extension run compile`

## 13) Required Deliverables Per New Topic
For each new topic, minimum deliverables:

1. Topic file in canonical taxonomy path.
2. New/updated index entry in `topics.index.yaml`.
3. Profile updates (if baseline/default selection changes).
4. Questionnaire updates (if new selection tags are required).
5. Test updates (if behavior/selection changes).
6. Documentation sync:
- `docs/product/living-spec.md` (if behavior contract changed)
- `docs/product/decision-log.md` (if architectural decision changed)

## 14) Authoring Algorithm (Step-by-Step)
Use this exact sequence:

1. Define topic intent and scope boundary.
2. Choose taxonomy path (`topics/...`) and stable `file_id`.
3. Draft metadata block (all required keys).
4. Write body using fixed section order.
5. Add/adjust topic index entry.
6. Add/adjust profile baseline/default capability linkage.
7. Add/adjust questionnaire emitted tags (if needed).
8. Check dependency/conflict graph consistency.
9. Run validators and tests.
10. Sync extension mirror assets.
11. Re-run tests/compile after sync.
12. Produce final change summary with selected-topic rationale.

## 15) Determinism Checklist
A new topic package is acceptable only if:
- Same questionnaire answers produce same selected topic set.
- Same selected topic set produces same ordered output list.
- Reason tags are stable (`selected_by_profile_baseline`, `selected_by_capability`, `selected_as_dependency`, etc.).
- No non-deterministic ordering in indexes/profiles.

## 16) Safety Checklist
- Topic does not instruct editing managed core files directly in consumer project.
- Topic clearly points to override path for consumer customization.
- Topic does not relax integrity checks or drift protections.
- Topic does not introduce destructive behavior expectations.

## 17) Validation Checklist (Operational)
Run and pass:

1. `scripts/validate-governance.sh`
2. `npm --prefix packages/vscode-extension run verify:onboarding-assets-sync`
3. `npm --prefix packages/vscode-extension test`
4. `npm --prefix packages/vscode-extension run compile`

If any fails, topic package is not release-ready.

## 18) Minimal Example Topic (Complete)
```md
<!--
file_id: dotnet-auth-guardrails
category: technology-specific
severity: high
required: false
applicability:
  ecosystems: [dotnet]
  languages: [csharp]
  project_types: [web-api]
overridable_sections: [Recommended Practices, Prompt Starters]
bundle_id: <bundle-id>
bundle_version: <bundle-version>
extension_version: <extension-version>
sync_marker: <sync-marker>
-->

# .NET Authentication Guardrails

## Intent
Ensure Codex preserves secure authentication defaults when changing backend code.

## Applicability
Applies to C# backend services in Web API style projects.

## Mandatory Rules
- Do not disable authentication middleware in production code paths.
- Do not weaken token validation defaults without explicit rationale.

## Recommended Practices
- Prefer explicit auth policies over implicit defaults.
- Keep auth configuration centralized.

## Anti-Patterns
- Bypassing auth checks for convenience.
- Mixing test-only auth shortcuts into runtime code.

## AI Execution Contract
- Before auth changes, list impacted endpoints and policy implications.
- If uncertainty exists, propose safe fallback and ask for confirmation.

## Prompt Starters
- "Read this topic and summarize mandatory auth constraints before editing."
- "Propose an auth-safe implementation plan with rollback notes."

## Validation Checklist
- Auth middleware still active.
- Policy registration unchanged or improved.
- No insecure defaults introduced.

## Allowed Override Surface
- Recommended Practices
- Prompt Starters

## Change Impact Notes
Auth changes may affect endpoint accessibility and integration tests.
```

## 19) Import Checklist for Maintainers
When importing an externally generated package:

1. Validate file naming and taxonomy path.
2. Validate metadata completeness.
3. Validate section order.
4. Validate index references and dependency graph.
5. Validate profile/questionnaire coherence.
6. Run full validation/test/compile chain.
7. Sync mirror and re-run checks.

## 20) Common Failure Modes and Fixes
1. Failure: topic file exists but not indexed.
- Fix: add entry to `topics.index.yaml`.

2. Failure: index entry points to missing file.
- Fix: correct `path` or add missing file.

3. Failure: baseline topic ID not found.
- Fix: align profile `baseline_topics` with index `file_id`.

4. Failure: conflicting topics selected together.
- Fix: encode `conflicts_with` and validate selector rules.

5. Failure: non-deterministic selection order.
- Fix: stabilize tags/inputs and rely on deterministic sort policy.

## 21) Definition of Done (Topic Package)
A topic package is done when all are true:
- Contracts satisfied.
- Validators pass.
- Tests pass.
- Compile passes.
- Mirror sync passes.
- Docs updated if behavior changed.
- No unresolved integrity/safety ambiguity remains.

## 22) Governance Reminder
- Canonical source is `.codex-onboarding/**`.
- Never edit `packages/vscode-extension/onboarding-assets/**` directly.
- Keep behavior-impact docs synchronized in the same change cycle.
