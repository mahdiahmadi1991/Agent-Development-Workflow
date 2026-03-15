# Codex Onboarding Contract

Version: `0.1.0`

## Objective
Define a stable contract for how Codex onboarding assets are structured and resolved in consumer projects.

## Required Paths
- `.codex-onboarding/core/` (managed baseline)
- `.codex-onboarding/overrides/` (consumer customization)

## Resolution Order
1. Core baseline
2. Overrides (overridable keys only)

## Integrity Rules
- Direct edits to managed core are policy violations.
- Overrides must not redefine non-overridable keys.
- Tooling must emit diagnostics when violations are detected.
