# Codex Onboarding Workflow

A public, reusable workspace for designing and maintaining **Codex-only onboarding architecture**.

This repository is focused on:
- defining portable, domain-agnostic onboarding structures for Codex,
- codifying governance and behavior rules in a layered policy model,
- enabling safe project-level customization through overrides,
- preparing the foundation for a VS Code extension that installs and validates this structure.

## Core Principles
- Codex-only scope (no multi-agent targeting).
- English-only onboarding and governance artifacts.
- Dynamic strictness based on policy risk.
- Immutable managed core plus controlled overrides.

## Repository Structure
- `AGENTS.md`: project-level behavior and governance rules.
- `docs/governance/`: policy hierarchy, override model, and standing agreements.
- `docs/extension/`: architecture baseline for the VS Code extension.
- `codex-onboarding/core/`: managed baseline artifacts (immutable by policy).
- `codex-onboarding/overrides/`: project-specific customization path.
- `packages/vscode-extension/`: planned extension package.

## Branching Model
- `main`: approved and protected branch.
- `develop`: active work branch.

Workflow policy: changes are prepared on `develop` and merged to `main` after explicit approval.

## License
This project is licensed under the MIT License. See [LICENSE](./LICENSE).
