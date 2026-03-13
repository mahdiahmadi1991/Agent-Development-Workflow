# Codex Onboarding

![Codex Onboarding Extension Banner](https://cdn.jsdelivr.net/gh/mahdiahmadi1991/Codex-Onboarding-Workflow@HEAD/packages/vscode-extension/assets/branding/banner-extension.png)

Codex Onboarding is a VS Code extension that applies a managed onboarding layer to your current project.

It is designed for safe, non-destructive onboarding flows where extension-managed artifacts are kept separate from user-owned project files.

## What It Does

- installs a managed onboarding baseline into `.codex-onboarding/`
- supports `Install`, `Repair`, and `Remove` lifecycle commands
- prevents unsafe overwrite of existing user-owned files
- blocks updates when managed-file drift is detected
- writes deterministic operation trace logs for debugging

## Command Surface

- `Codex Onboarding: Install`
- `Codex Onboarding: Repair`
- `Codex Onboarding: Remove`

The extension intentionally keeps command surface minimal.

## Managed Paths

- managed core: `.codex-onboarding/core/`
- user overrides: `.codex-onboarding/overrides/`
- managed state: `.codex-onboarding/.managed/state.json`

## Safety Model

- non-destructive by default
- managed ownership boundary is strict
- extension updates only extension-owned managed files
- drift detection is fail-fast
- up-to-date runs skip unnecessary writes

## Dynamic Selection Model

Install/repair flow is split into two groups:

1. Operational Questions
2. Profile Selection Questions (dynamic, file-driven)

Questionnaire and selection assets are loaded from extension-bundled onboarding assets.

## Logging

Each lifecycle run creates a dedicated trace log file with structured events and severity levels.

Severity categories:

- `debug`
- `warning`
- `error`

## Supported Environments

- Windows
- WSL
- Linux
- macOS

For current tested matrix details, see project docs:

- `docs/product/environment-support-matrix.md`

## Release and Update Transparency

Before applying updates, users should be able to review:

- `CHANGELOG.md`
- `docs/releases/v<version>.md`

## Source and Governance

- repository: `https://github.com/mahdiahmadi1991/Codex-Onboarding-Workflow`
- publisher: `Mohammad Mahdi Ahmadi`

Extension behavior and governance contracts are maintained in repository docs and synced with release workflow gates.
