# Dynamic Tree Install Wizard Proposal (Draft)

## Status
Draft (review required before implementation)

## Purpose
Define a fully data-driven install wizard for `Profile Selection Questions` that supports:
- N-layer tree traversal
- progressive follow-up questions based on prior selections
- multi-select in any layer where config allows it
- mixed technology selection in one workspace/root
- zero hardcoded technology/topic menu logic in extension runtime

This document is implementation guidance only. No runtime implementation is approved by this document alone.

## Naming (for clear discussion)
Use these fixed names in docs and team conversations:
1. `Operational Questions`: runtime/safety questions (root, Git mode, permissions).
2. `Technology Selection Wizard`: dynamic, config-driven tree of project technology/profile menus.
3. `Tree Node`: one question layer in the wizard.
4. `Branch`: one selected path from root node to one or more leaf nodes.
5. `Selection Payload`: normalized output passed from wizard to resolver.

## Target User Experience
Example workspace/root contains both backend and frontend projects.
1. User runs `Install`.
2. Extension asks operational questions.
3. Wizard asks top-level project domains (multi-select allowed), e.g. `Backend`, `Frontend`.
4. For each selected domain, wizard asks only relevant child nodes (progressive branching).
5. Child nodes may also be multi-select, e.g. backend technologies and cross-cutting concerns.
6. Final output merges all branches and applies matching onboarding artifacts.

## Core Requirements
1. All menu definitions are loaded from questionnaire files; runtime only hosts a generic engine.
2. Tree depth must be unbounded (`N` layers).
3. Node selection mode is configurable per node (`single` or `multi`).
4. Multi-select nodes support `min_select` and `max_select`.
5. Branch outputs are deterministic (stable ordering, dedupe, explicit merge rules).
6. Resolver-facing output is normalized and explainable.
7. Broken configs fail fast before partial install.

## Advanced Maturity Extensions (Recommended)
The following extensions make the wizard significantly more dynamic, maintainable, and scalable.

### A) Rule Engine for Dynamic Visibility and Enablement
Add optional rule blocks to nodes/options:
- `visible_when`
- `enabled_when`
- `required_when`

Rules are evaluated against:
- prior wizard answers
- operation context (workspace root, Git presence)
- project signals (detected tech hints)

Constraint:
- rule syntax must be declarative and data-only (no executable scripts in config).

Example shape:
```yaml
visible_when:
  all:
    - fact: answer.project_domain
      in: [backend]
    - fact: env.git_available
      eq: true
```

### B) Project Slice Model (Multi-Track Selection)
Allow the user to define one or more logical project slices in one root (e.g., `backend-api`, `frontend-app`).
Each slice runs the tree with independent answers and emits independent payload fragments, then merge happens at the end.

Benefits:
- cleaner representation for mixed-stack repositories
- easier explainability and troubleshooting

### C) Stable Taxonomy IDs
All runtime logic must depend on immutable IDs only:
- node IDs
- option IDs
- family keys

`label` and `description` are presentation-only and can change without behavioral impact.

### D) Dependency and Conflict Planner (Pre-Apply Gate)
Before any write, compute a plan:
- `requires`: selections/topics that must exist together
- `conflicts_with`: selections/topics that cannot coexist
- `recommends`: optional improvements

If conflicts exist, operation is blocked with clear QuickPick guidance and resolution options.

### E) Auto-Detect + User Confirm
Wizard can preselect recommendations from repository heuristics:
- solution/project files
- framework markers
- directory conventions

Each recommendation must include:
- `confidence` (`high`, `medium`, `low`)
- `evidence` list

User can always override. No automatic final selection without explicit confirmation.

### F) Explainability Contract
Every selected or skipped artifact must be explainable.
Wizard/resolver output should include:
- `why_selected[]`
- `why_skipped[]`
- `selected_by` (`baseline`, `capability`, `dependency`, `manual`)

This enables transparent preview, debugging, and issue reporting.

### G) Config Composition and Reuse
Support reusable fragments and inheritance to avoid duplicated menu trees:
- `imports[]`
- `extends`
- deterministic override precedence

Constraint:
- composition cycle detection must block invalid configs.

### H) Deep Quality Gates
CI/validation should additionally enforce:
- cycle detection in graph/composition
- dead-node/unreachable-node detection
- duplicate emitter key detection
- max-depth sanity guard (configurable)
- deterministic snapshot of final payload for known answer sets

## Execution Risks and Locked Mitigations
The following risks are considered active and must be addressed in implementation scope.

### R1) Tree Config Complexity and Drift
Risk:
- large trees increase probability of broken references, dead nodes, and accidental drift.

Mitigations (mandatory):
- strict schema + graph validation before wizard render.
- CI gate blocks merge on invalid references/cycles/unreachable nodes.
- config ownership map and validator coverage must stay synchronized.

### R2) Multi-Layer QuickPick UX Ambiguity
Risk:
- users may lose context across deep/multi-select branches.

Mitigations (mandatory):
- each node prompt must include concise context cue.
- clear selection constraints (`min/max`) in prompt text.
- on validation failure, same node reopens with explicit corrective message.

### R3) Non-Deterministic Merge/Resolution
Risk:
- same answers might produce different output ordering or file sets.

Mitigations (mandatory):
- deterministic merge order defined by config declaration order.
- stable dedupe key contract.
- snapshot tests for identical input -> identical payload and artifact plan.

### R4) Rule Engine Overreach
Risk:
- overly powerful rule language can create opaque or unsafe behavior.

Mitigations (mandatory):
- declarative DSL only (no script execution, no dynamic code eval).
- explicit allowed facts namespace (`answer.*`, `env.*`, `detect.*`).
- rule evaluator must emit traceable evaluation outcomes for debugging.

### R5) Auto-Detect False Positives
Risk:
- wrong preselected suggestions can reduce trust.

Mitigations (mandatory):
- auto-detect is recommendation-only.
- each recommendation must expose `confidence` and `evidence`.
- user override is always available and final.

### R6) Explainability Gaps
Risk:
- users cannot understand why specific artifacts were installed/skipped.

Mitigations (mandatory):
- payload must include `why_selected[]` and `why_skipped[]`.
- post-install summary must surface explainability in concise form.
- issue-reporting flow can include explainability excerpts.

### R7) Performance Degradation on Large Trees
Risk:
- deep or broad trees can degrade prompt responsiveness.

Mitigations (mandatory):
- parse/validate once per operation, then reuse in-memory model.
- fail-fast before first user interaction when config is invalid.
- optional max-depth and node-count sanity guards.

## Data Contracts
All contracts are under `.codex-onboarding/library/questionnaires/`.

### 1) Registry Contract
`index.yaml` declares available questionnaire families and entry flow file paths.

Minimal shape:
```yaml
version: 1
families:
  dotnet-csharp:
    install_flow: .codex-onboarding/library/questionnaires/dotnet-csharp/install-tree.yaml
```

### 2) Tree Contract
Each family tree file defines:
- `family`
- `entrypoint`
- `nodes[]`

Node shape:
- `id`: unique in file
- `type`: currently `select`
- `question`: prompt text
- `selection_mode`: `single | multi`
- `min_select` / `max_select`: optional, for `multi`
- `options[]`

Option shape:
- `id`
- `label`
- `description` (optional)
- `next`: optional next node id
- `emits`: optional contribution to payload:
  - `capability_tags[]`
  - `profile_hints[]`
  - `topic_tags[]`
  - `family_keys[]`

### 3) Optional Reuse Contract
Optional shared fragments can be referenced by tree files:
- `.codex-onboarding/library/questionnaires/fragments/*.yaml`

## Traversal Model (Deterministic)
Recommended runtime algorithm:
1. Load registry and selected family tree.
2. Validate full tree graph and constraints.
3. Start from `entrypoint`.
4. Render node with QuickPick based on `selection_mode`.
5. For every selected option:
- collect `emits`
- queue option-specific `next` node (if present)
6. Continue until all queued branches terminate.
7. Merge all emitted outputs into one normalized payload.

Determinism rules:
- preserve declaration order from config
- stable dedupe by key
- no random ordering

## QuickPick Behavior Contract
For `single`:
- regular single QuickPick

For `multi`:
- `canPickMany: true`
- validate `min_select`/`max_select`
- if invalid, re-prompt same node with concise error message

Cancellation:
- any cancellation aborts operation with explicit blocked reason
- no partial write allowed before wizard completion
- cancellation event must preserve the last active node id in trace logs

## Output Contract (Wizard -> Resolver)
Wizard emits:
- `selected_paths[]` (full branch path IDs)
- `capability_tags[]`
- `profile_hints[]`
- `topic_tags[]`
- `family_keys[]`
- `raw_answers` (trace/debug only)
- `selection_slices[]` (when multi-slice is used)
- `recommendations_used[]` (auto-detect suggestions accepted by user)
- `why_selected[]`
- `why_skipped[]`

Resolver must consume this payload without requiring hardcoded domain switches.

## Multi-Project/Mixed-Stack Support
The wizard must support mixed selections in one run, e.g.:
- Domain: `Backend` + `Frontend`
- Backend stack: `.NET`, `Web API`
- Frontend stack: `React`
- Cross-cutting: `Repository Hygiene`, `Observability`

Result is a composed, deduplicated artifact set built from all selected branches.

## Validation and Quality Gates
Required validations:
1. Tree schema validity.
2. Node ID uniqueness.
3. All `next` references exist.
4. `entrypoint` exists.
5. `min_select <= max_select` when both provided.
6. No unreachable nodes unless explicitly allowed by policy.
7. Rule block schema validity (`visible_when`, `enabled_when`, `required_when`).
8. Composition graph validity (`imports`, `extends`) and no cycles.
9. Conflict/dependency declarations reference valid IDs.
10. Allowed-facts-only validation for rule expressions.
11. Max-depth/node-count sanity checks when policy enables hard limits.

Required tests:
1. Unit: parser, validator, traversal engine, merge determinism.
2. Scenario: mixed Backend+Frontend flow, deep N-layer flow, invalid graph fail-fast, multi-select constraints.
3. Integration: selection payload resolves to expected artifact set.
4. Heuristic tests: auto-detect suggestions include confidence/evidence and remain overridable.
5. Explainability tests: `why_selected/why_skipped` are generated deterministically.
6. Performance tests: large-tree traversal remains responsive within target threshold.

## Implementation Phases (After Approval)
### Phase 1: Contract Lock
- Finalize tree schema and output payload contract.
- Add/adjust schema validators for tree files.
- Finalize rule language and safety constraints.
- Lock deterministic merge and dedupe contract.

### Phase 2: Generic Wizard Engine
- Implement recursive/iterative tree runner for QuickPick traversal.
- Implement deterministic branch merge behavior.
- Implement rule evaluator and node gating.

### Phase 3: Resolver Bridge
- Map emitted payload fields to existing selection resolver inputs.
- Keep runtime free of hardcoded taxonomy logic.
- Add dependency/conflict planner pre-apply gate.

### Phase 4: UX and Logging
- Improve node prompt clarity and validation feedback.
- Extend trace events for node ask/answer/branch merge.
- Add recommendation explainability (confidence + evidence).
- Add cancellation trace context (`last_node_id`, reason).

### Phase 5: Test and CI Enforcement
- Add required unit/scenario/integration tests.
- Add CI checks for contract and graph integrity.
- Add deterministic explainability snapshot checks.

## Acceptance Criteria
1. Adding a new technology path requires config-only changes (no runtime logic changes).
2. Mixed project-type selection works in one install run.
3. Any valid tree depth works without code changes.
4. Invalid questionnaire config blocks install with clear diagnostics.
5. Resolver receives deterministic, explainable payload.
6. Conflict/dependency violations are blocked before apply with actionable guidance.
7. Auto-detect suggestions are optional, transparent, and always user-overridable.
8. Selection results are reproducible with stable IDs and deterministic merge order.
9. Rule expressions are safe, declarative, and fully validator-enforced.
10. Large-tree scenarios pass responsiveness threshold and remain usable.

## Recommendation
Approve this proposal as the contract target for the next implementation step.
After approval, execute phases in order with schema-first and test-first gates.
