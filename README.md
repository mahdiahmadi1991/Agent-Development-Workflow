# Codex Onboarding Workflow

A public, reusable workspace for designing and maintaining **Codex-only onboarding architecture**.

This repository is focused on:
- codifying governance and behavior rules in a layered policy model,
- enabling safe project-level customization through overrides,
- preparing the foundation for a VS Code extension that installs and validates this structure.

## Core Principles
- Codex-only scope (no multi-agent targeting).
- English-only onboarding and governance artifacts.
- Dynamic strictness based on policy risk.
- Immutable managed core plus controlled overrides.
- Non-destructive application in consumer projects (no overwrite by default).

## Current Phase
- Active focus: extension infrastructure and behavior implementation planning.
- Deferred: onboarding topic content authoring.
- Managed-file version synchronization is in scope for extension-owned assets.

## Repository Structure
- `AGENTS.md`: project-level behavior and governance rules.
- `CHANGELOG.md`: canonical project changelog.
- `docs/governance/`: policy hierarchy, override model, and standing agreements.
- `docs/governance/sources-of-truth.md`: canonical ownership map for decisions and anti-duplication.
- `docs/governance/drift-control.md`: drift-risk controls and synchronization gates.
- `docs/governance/context-boundary-map.yaml`: technical/policy boundary between governance sources and extension artifact roots.
- `docs/product/`: living spec and planning decision log.
- `docs/product/implementation-roadmap.md`: locked operational roadmap for future implementation.
- `docs/product/onboarding-template-standard.md`: fixed onboarding file structure standard.
- `docs/product/onboarding-template-proposal.md`: archived proposal history for the standard.
- `docs/product/asset-library-storage-standard.md`: fixed storage taxonomy for onboarding source assets.
- `docs/product/selection-resolution-standard.md`: deterministic profile/questionnaire-based file selection contract.
- `docs/product/question-model-contract.md`: two-group question model (operational + dynamic profile/topic).
- `docs/product/topics-index-contract.md`: authoritative topic index contract and integrity rules.
- `docs/product/managed-state-contract.md`: authoritative managed-state and synchronization contract.
- `docs/product/scenario-matrix.md`: expected install/update behavior matrix.
- `docs/product/ci-cd-requirements.md`: release pipeline quality and integrity gates.
- `docs/product/branding-requirements.md`: extension identity and marketplace copy requirements.
- `docs/product/command-surface.md`: minimal command lifecycle contract.
- `docs/product/platform-compatibility.md`: cross-platform behavior requirements.
- `docs/product/testing-strategy.md`: required testing layers and release gates.
- `docs/product/operation-logging-spec.md`: trace-level diagnostics contract.
- `docs/product/recovery-policy.md`: rollback and recovery behavior policy.
- `docs/product/update-consent-policy.md`: explicit user-consent update behavior.
- `docs/product/privacy-telemetry-policy.md`: diagnostics privacy baseline.
- `docs/product/pre-install-transparency.md`: required pre-install behavior-impact summary contract.
- `docs/product/post-install-success-experience.md`: post-install success message and guidance-page contract.
- `docs/product/bootstrap-onboarding-file-contract.md`: mandatory static onboarding bootstrap artifact contract.
- `docs/product/issue-escalation-policy.md`: user-controlled upstream conflict-report escalation policy.
- `docs/product/environment-support-matrix.md`: supported/tested/unsupported environment listing.
- `docs/product/git-tracking-option.md`: Git ignore tracking-mode policy.
- `docs/product/release-documentation-policy.md`: release notes + changelog requirements.
- `docs/releases/`: per-version release notes (`v<version>.md`).
- `docs/consumer/README.md`: consumer-facing behavior and impact summary.
- `docs/consumer/AI-Quickstart.md`: consumer-facing AI interaction quick-start prompts.
- `scripts/validate-onboarding-assets.sh`: onboarding template compliance validator.
- `scripts/validate-governance.sh`: governance baseline validator.
- `scripts/validate-release-docs.sh`: release docs validator (`CHANGELOG.md` + `docs/releases/`).
- `scripts/validate-vscode-extension-version.sh`: release/package version alignment validator.
- `docs/extension/`: architecture baseline for the VS Code extension.
- `codex-onboarding/library/`: source onboarding asset library for profile-based selection.
- `codex-onboarding/core/`: managed baseline artifacts (immutable by policy).
- `codex-onboarding/overrides/`: project-specific customization path.
- `packages/vscode-extension/`: VS Code extension package implementation.

## Branching Model
- `main`: approved and protected branch.
- `develop`: active work branch.

Workflow policy: changes are prepared on `develop` and merged to `main` after explicit approval.

## License
This project is licensed under the MIT License. See [LICENSE](./LICENSE).
