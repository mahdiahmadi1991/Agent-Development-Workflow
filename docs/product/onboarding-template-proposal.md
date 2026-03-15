# Onboarding File Template Proposal (Archived)

Status: approved and promoted to `docs/product/onboarding-template-standard.md`.

## Purpose
Define a fixed template contract for onboarding files so structure remains stable across future bundles.

## Proposed Fixed Contract
1. Topic files are modular and one-topic-per-file.
2. Each topic file must start with a `comment block` metadata header.
3. Metadata must include:
- identity (`file_id`, `topic`, `category`)
- applicability (`ecosystems`, `languages`, `project_types`, `layers`)
- policy (`severity`, `overridable`, `overridable_sections`)
- ownership/sync fields (`bundle_id`, `bundle_version`, `extension_version`, `sync_marker`, digest)
4. Topic body sections remain in this exact order:
- Intent
- Applicability
- Mandatory Rules
- Recommended Practices
- Anti-Patterns
- AI Execution Contract
- Prompt Starters
- Validation Checklist
- Allowed Override Surface
- Change Impact Notes
5. Override files can change only sections explicitly marked overridable.
6. Bundle manifest maps topic files to profiles and update/logging policies.

## Proposal Scope
This proposal defines structure only, not topic content.

## Draft Artifacts
- `.codex-onboarding/templates/topic-instruction.template.md`
- `.codex-onboarding/templates/topic-override.template.md`
- `.codex-onboarding/templates/bundle-manifest.template.yaml`

## Resolution
This proposal has been accepted and converted into the fixed standard document.
