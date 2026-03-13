# Release Documentation Policy

## Goal
Ensure every release communicates behavior-impact changes clearly and consistently.

## Mandatory Artifacts Per Release
1. Release notes
- Summary of changes
- Behavior-impact highlights
- Migration/update guidance
- Canonical path: `docs/releases/v<version>.md`

2. Changelog update
- Version entry with categorized changes
- Links to decision IDs where applicable
- Canonical file: `CHANGELOG.md`

## Mandatory Quality Checks
- Release notes and changelog must be published before release publish step.
- Release version must match extension package version in `packages/vscode-extension/package.json`.
- User-facing pre-install transparency summary must be synchronized with release behavior.
- Release flow is two-stage: validation/packaging first, publish actions only after successful artifact gate.

## Governance Rule
No release is valid without release notes and changelog updates.
