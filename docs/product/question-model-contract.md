# Question Model Contract

## Goal
Define a stable and scalable question system for install/repair flows without hardcoding project/topic logic in extension code.

## Question Groups
1. Group A: Operational Questions
- Purpose: collect extension/runtime operation choices.
- Examples: target root selection, Git tracking mode, safety acknowledgements.
- Ownership: extension behavior layer.

2. Group B: Profile/Topic Questions
- Purpose: collect project/profile/topic signals used for resolver composition.
- Ownership: data files in onboarding library.
- Source: questionnaire files loaded dynamically by selected profile family.

## Dynamic Source Contract (Group B)
- Registry file: `codex-onboarding/library/questionnaires/index.yaml`
- Family flow file pattern: `codex-onboarding/library/questionnaires/<family>/install-flow.yaml`
- Extension must resolve flow definitions from registry/paths, not hardcoded switch logic.

## Runtime Requirements
1. Ask Group A first when required by operation context.
2. Resolve selected profile family and load Group B flow dynamically.
3. Map Group B answers to capability/profile signals for resolver input.
4. Keep deterministic result for identical inputs.

## Safety Rules
- Unknown/missing questionnaire definitions must fail fast with diagnostics.
- No implicit fallback to hidden defaults for missing required questions.
- Question flow changes must be reflected in scenario/test/CI contracts.
