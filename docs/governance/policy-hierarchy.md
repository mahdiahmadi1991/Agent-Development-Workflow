# Policy Hierarchy

This project uses a layered policy model to keep baseline behavior stable while allowing controlled customization.

## Layers (Highest to Lowest Priority)
1. Core managed policies (`codex-onboarding/core/`)
2. Consumer overrides (`codex-onboarding/overrides/`)
3. Local task notes or temporary instructions

## Merge Semantics
- If a policy key exists only in core, core value is used.
- If a policy key exists in core and override, override wins only for keys marked as overridable.
- Non-overridable keys must stay fixed (for safety/integrity constraints).

## Strictness by Domain
- High risk domains: strict + non-overridable by default.
- Medium risk domains: strict default, overridable with explicit rationale.
- Low risk domains: guideline level, overridable.

## Design Goal
Preserve stability of the core onboarding contract while giving projects a safe extension mechanism.
