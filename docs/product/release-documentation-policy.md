# Release Documentation Policy

## Goal
Ensure every release communicates behavior-impact changes clearly and consistently.

## Mandatory Artifacts Per Release
1. Release notes
- Summary of changes
- Behavior-impact highlights
- Migration/update guidance
- Decision references (`D-xxx`) when linked in changelog
- Canonical path: `docs/releases/v<version>.md`

2. Changelog update
- Version entry with categorized changes
- Decision links where applicable
- Canonical file: `CHANGELOG.md`

## Mandatory Quality Checks
- Release notes and changelog must be published before release publish step.
- Release version must match extension package version in `packages/vscode-extension/package.json`.
- User-facing pre-install transparency summary must be synchronized with release behavior.
- Release flow is two-stage: validation/packaging first, publish actions only after successful artifact gate.
- Release notes must contain required sections validated by `scripts/validate-release-docs.sh`.

## Standard Authoring Flow
1. Update `CHANGELOG.md` for target version.
2. Run `scripts/scaffold-release-note.sh <version>`.
3. Review and refine generated release note content.
4. Run `scripts/validate-release-docs.sh <version>`.

## Publisher Operation Reference
- Publish execution runbook: `docs/product/publisher-release-runbook.md`

## Governance Rule
No release is valid without release notes and changelog updates.
