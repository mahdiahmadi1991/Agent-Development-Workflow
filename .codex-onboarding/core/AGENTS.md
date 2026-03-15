<!--
artifact_id: core-agent-onboarding
managed: true
schema_version: 1
bundle_id: TBD
bundle_version: TBD
extension_version: TBD
-->

# Codex Onboarding Bootstrap

## Purpose
This file introduces Codex to the onboarding model applied in this project.

## Scope
- This onboarding system targets Codex behavior only.
- Managed artifacts are installed under `.codex-onboarding/`.

## Ownership Model
- Managed baseline path: `.codex-onboarding/`
- Consumer customization path: `.codex-onboarding/overrides/`
- Managed baseline files must not be edited directly.

## Policy Resolution
1. Managed core baseline.
2. Consumer overrides in allowed override surface.
3. Task-local instructions.

## Safe Lifecycle Summary
- Install is non-destructive by default.
- Update/repair applies only to extension-owned managed files.
- Drift in managed files blocks update operations.
- Remove deletes only unchanged managed files.

## How To Work With Codex
- Ask Codex to follow managed onboarding and override boundaries.
- Request rationale using selected topics and `why-selected` preview when available.
- Use overrides for project-specific exceptions instead of editing managed core files.

## Conflict Reporting
- If onboarding behavior conflicts with your needs, use overrides first.
- If conflict remains unresolved, follow `.codex-onboarding/ISSUE-REPORTING.md`.

## Indexed Managed Instructions
- `.codex-onboarding/ISSUE-REPORTING.md`:
  - Guidance for Codex and user-controlled upstream issue suggestion flow.
  - No automatic submission without explicit user approval.
