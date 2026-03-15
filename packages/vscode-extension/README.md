# Codex Onboarding

![Codex Onboarding Extension Banner](https://cdn.jsdelivr.net/gh/mahdiahmadi1991/Codex-Onboarding-Workflow@HEAD/packages/vscode-extension/assets/branding/banner-extension.png)

Codex Onboarding is a VS Code extension that applies a managed onboarding layer to your current project.

It is designed for safe, non-destructive onboarding flows where extension-managed artifacts are kept separate from user-owned project files.

## What It Does

- installs a managed onboarding baseline into `.codex-onboarding/`
- supports `Install`, `Repair`, and `Remove` commands
- prevents unsafe overwrite of existing user-owned files
- blocks updates when managed-file drift is detected
- writes deterministic operation trace logs for debugging
- includes managed AI guidance at `.codex-onboarding/ISSUE-REPORTING.md` for user-controlled upstream issue suggestion flow


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
- remove is impact-scan driven (clean remove without prompt, destructive full-root remove only after explicit confirmation)
- drift detection is fail-fast
- up-to-date runs skip unnecessary writes

## Dynamic Selection Model

Install flow runs in this order:

1. Installation Scope
2. Project Technology Family (dynamic, only when multiple families exist in registry)
3. Project Profile (dynamic, file-driven)
4. Review & Apply Git Tracking
5. Root `AGENTS.md` Integration (auto-create when missing; permission-gated edit when existing)

Questionnaire and selection assets are loaded from extension-bundled onboarding assets.

## Development Note (Asset Source Model)

- Canonical onboarding source lives at repository root: `.codex-onboarding/**`
- Extension runtime/package consumes generated mirror: `packages/vscode-extension/onboarding-assets/**`
- Do not edit mirror files directly.
- Sync and verify with:
  - `npm run sync:onboarding-assets`
  - `npm run verify:onboarding-assets-sync`

## Logging

On operation failure, the extension auto-opens the VS Code Output channel and highlights trace diagnostics.
Successful and user-canceled flows do not auto-open Output by default.
Each run also creates a dedicated trace log file with structured events and severity levels.
On successful install/repair, a project mirror is written to `.codex-onboarding/.managed/logs/`.
The extension manages `.codex-onboarding/.gitignore` so mirrored logs remain untracked by default.

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
