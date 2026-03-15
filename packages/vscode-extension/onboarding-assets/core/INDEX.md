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
3. `.codex-onboarding/ISSUE-REPORTING.md` (only when conflict escalation is relevant)
4. `.codex-onboarding/core/topics/**` (only files relevant to the current task)
5. `.codex-onboarding/overrides/**` (if present and relevant)

## Resolution Rules
- Managed baseline guidance comes from `.codex-onboarding/**`.
- User-specific exceptions come from `.codex-onboarding/overrides/**`.
- If a file is irrelevant to the active task, do not load it.

## Noise Control
- Start with this index and load only required files.
- Avoid broad scanning of all onboarding files by default.
- Prefer concise summaries before deep dives.

## Root Project Integration (Optional, Manual)
- Extension does not auto-edit root `AGENTS.md`.
- If the user wants stronger discoverability, they can add a manual note in project-root `AGENTS.md` that points to:
  - `.codex-onboarding/INDEX.md`
