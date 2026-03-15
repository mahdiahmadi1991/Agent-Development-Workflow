# Question Model Contract

## Goal
Define a stable and scalable question system without hardcoding project/topic logic in extension code.

## Question Groups
1. Operational Questions
- Purpose: collect extension/runtime operation choices.
- Examples: target root selection, Git tracking mode, root `AGENTS.md` edit permission, safety acknowledgements.
- Ownership: extension behavior layer.

2. Profile Selection Questions
- Purpose: collect project/profile/topic signals used for resolver composition.
- Ownership: data files in onboarding library.
- Source: questionnaire files loaded dynamically by selected profile family.

## Dynamic Source Contract (Profile Selection Questions)
- Registry file: `.codex-onboarding/library/questionnaires/index.yaml`
- Family flow file pattern: `.codex-onboarding/library/questionnaires/<family>/install-flow.yaml`
- Extension must resolve flow definitions from registry/paths, not hardcoded switch logic.
- Family flow is a tree contract with unbounded depth (`N` layers).
- Each `select` node declares `selection_mode` (`single` or `multi`).
- Multi-select constraints (`min_select` / `max_select`) are enforced at runtime.
- Node/option visibility can be rule-gated by declarative expressions (`visible_when`, `required_when`, `enabled_when`).

## Runtime Requirements
1. Ask Operational Questions first when required by operation context.
2. For install flow, resolve selected profile family and load Profile Selection Questions flow dynamically.
  - If questionnaire catalog has no configured families, skip Profile Selection Questions and continue install with core-only managed artifacts.
3. Execute tree traversal progressively based on selected option `next` links.
4. For install flow, map selected options to capability/profile signals using both answer tags and option `emits`.
5. Preserve deterministic output for identical questionnaire, context, and answers.
4. For repair flow, use existing managed state from selected workspace root as source of truth.

## Safety Rules
- Unknown/missing questionnaire definitions must fail fast with diagnostics.
- No implicit fallback to hidden defaults for missing required questions.
- Question flow changes must be reflected in scenario/test/CI contracts.
- Rule expressions only allow approved fact namespaces (`answer.*`, `env.*`, `detect.*`).
