# Command Surface (Minimal)

## Goal
Keep extension UX minimal and predictable while preserving safe lifecycle control.

## User-Facing Commands
1. `Codex Onboarding: Install`
- Installs managed onboarding files for selected target.
- Runs synchronization logic when managed state already exists.
- If update is available, surfaces changelog/release notes and proceeds only after explicit confirmation.
- Update confirmation is blocked until both release notes and changelog are reviewed in the update gate.
- Must present or link a pre-install behavior summary before applying changes.
- Must offer Git tracking choice for managed paths (`ignore` or `track`) only when selected root is a Git repository.
- Must evaluate root `AGENTS.md` integration:
  - If root `AGENTS.md` is missing, create it automatically with onboarding pointer.
  - If root `AGENTS.md` exists, ask explicit permission before editing.
  - If permission is denied, keep file unchanged and provide manual snippet in post-install page.
- On success, must show summary notification and open dedicated post-install WebviewPanel.
- If `ignore` is selected, success summary must explain that ignore is applied via `.git/info/exclude` and how to exit ignore mode.

2. `Codex Onboarding: Remove`
- Clears managed state.
- Runs pre-remove scan on `.codex-onboarding/` to detect:
  - managed-file drift (modified or missing tracked managed files)
  - additional user-created files not owned by extension
- If no changes are detected, remove executes directly with no confirmation.
- If changes are detected, show a destructive `QuickPick` warning.
- If user confirms destructive mode, remove deletes entire `.codex-onboarding/` root.
- If user declines, remove is canceled.
- On successful remove, extension also removes extension-managed pointer content from root `AGENTS.md` when present.

3. `Codex Onboarding: Repair`
- Runs only when managed onboarding evidence already exists in selected workspace root.
- If no managed onboarding evidence exists, operation is blocked and user is redirected to `Install`.
- Performs state-driven reset using the current managed bundle/version already recorded in project state.
- If managed state is missing/corrupt/empty but managed files are intact, repair recovers source metadata from managed files and rebuilds state.
- If tracked managed files are edited/missing, show a destructive-reset `QuickPick` warning before overwrite.
- If tracked managed files are unchanged, run repair without extra confirmation.
- On successful repair, extension removes extension-managed pointer content from root `AGENTS.md` when present.

## Install Prompt Model
1. `Installation Scope`
- Select workspace root in multi-root contexts.

2. `Project Profile` (dynamic)
- Load from questionnaire definitions and do not hardcode in command handlers.

3. `Git Tracking Preference`
- Ask whether managed files should be tracked in Git or ignored via repository-local `.git/info/exclude` only when Git repository exists at selected root.
- No additional final preview confirmation is shown after this step; install proceeds with non-destructive managed-write rules.

4. `Root AGENTS.md Permission` (conditional)
- Ask only when root `AGENTS.md` already exists in selected target root.
- If approved, append onboarding pointer snippet to root `AGENTS.md` when not already present.
- If declined, keep root file unchanged and present manual snippet in post-install Webview.

## Command Policy
- No broad option explosion in command palette.
- Update behavior is lifecycle logic under install flow, not a separate user command.
- Upstream issue escalation is advisory guidance only (instruction artifact), not a dedicated extension command.
- Project profile questions are dynamic data-driven flows for install command, not separate commands.
- All commands must produce deterministic operation reports.
- Output channel auto-opens only when a lifecycle command fails; normal success/cancel flows do not force Output focus.
