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

## Runtime Requirements
1. Ask Operational Questions first when required by operation context.
2. For install flow, resolve selected profile family and load Profile Selection Questions flow dynamically.
3. For install flow, map Profile Selection Questions answers to capability/profile signals for resolver input.
4. For repair flow, use existing managed state from selected workspace root as source of truth.
5. Keep deterministic result for identical inputs.

## Safety Rules
- Unknown/missing questionnaire definitions must fail fast with diagnostics.
- No implicit fallback to hidden defaults for missing required questions.
- Question flow changes must be reflected in scenario/test/CI contracts.
