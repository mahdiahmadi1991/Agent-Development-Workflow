# Override Model

## Problem
Consumer projects need flexibility, but editing managed core onboarding files causes drift and breaks upgrade paths.

## Solution
Use a dedicated override path with deterministic precedence.

## Paths
- Managed core: `.codex-onboarding/core/`
- Consumer overrides: `.codex-onboarding/overrides/`

## Rules
1. Core files are treated as immutable by policy.
2. Overrides are additive or selective replacement for overridable keys only.
3. Unsupported override keys are ignored and reported by tooling.
4. Upgrade process updates core first, then re-evaluates overrides.

## Enforcement Strategy (for future extension)
- Add validation to detect direct edits under `core/`.
- Block apply/update when immutable files are modified manually.
- Provide diagnostics pointing users to `overrides/`.
