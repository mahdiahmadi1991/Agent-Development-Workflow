<!--
artifact_id: core-onboarding-index
managed: true
schema_version: 1
bundle_id: TBD
bundle_version: TBD
extension_version: TBD
-->

# Codex Onboarding Index

## Purpose
Provide a deterministic entry point so Codex can discover onboarding scope with low noise.

## Read Order (Start Here)
1. `.codex-onboarding/INDEX.md` (this file)
2. `.codex-onboarding/AGENTS.md`
3. `.codex-onboarding/.managed/applied-artifacts.md` (runtime inventory of files installed by extension)
4. `.codex-onboarding/ISSUE-REPORTING.md` (only when conflict escalation is relevant)
5. `.codex-onboarding/core/topics/**` (only files relevant to the current task)
6. `.codex-onboarding/overrides/**` (if present and relevant)

## Installed Artifact Inventory
- Runtime-generated report path:
  - `.codex-onboarding/.managed/applied-artifacts.md`
- This report includes:
  - files applied in the current operation
  - skipped files
  - recovered/removed managed files
  - current managed inventory from `state.json`

## Resolution Rules
- Managed baseline guidance comes from `.codex-onboarding/**`.
- User-specific exceptions come from `.codex-onboarding/overrides/**`.
- If a file is irrelevant to the active task, do not load it.

## Noise Control
- Start with this index and load only required files.
- Avoid broad scanning of all onboarding files by default.
- Prefer concise summaries before deep dives.

## Root Project Integration (Optional, Manual)
- If root `AGENTS.md` does not exist, extension creates it automatically.
- If root `AGENTS.md` already exists, extension asks permission before editing it.
- If permission is denied, post-install guidance provides a manual snippet that points to:
  - `.codex-onboarding/INDEX.md`
