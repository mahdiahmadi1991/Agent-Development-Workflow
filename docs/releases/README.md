# Release Notes

This directory contains per-version release notes.

## Naming Convention
- Required: `v<version>.md` (for example, `v1.2.3.md`).

## Authoring Workflow
1. Update `CHANGELOG.md` with the target version section.
2. Generate release notes scaffold:
   - `scripts/scaffold-release-note.sh <version>`
3. Refine generated content and keep decision references accurate.
4. Validate release docs:
   - `scripts/validate-release-docs.sh <version>`

## Required Sections
Each release note document must contain:
- `## Summary`
- `## Behavior Impact`
- `## Migration Guidance`
- `## Decision References`
