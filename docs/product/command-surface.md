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
- On success, must show summary notification and open dedicated post-install WebviewPanel.
- If `ignore` is selected, success summary must explain that ignore is applied via `.git/info/exclude` and how to exit ignore mode.

2. `Codex Onboarding: Remove`
- Clears managed state.
- Removes extension-owned managed files only when they are unchanged from managed integrity state.
- Never deletes unmanaged consumer files or consumer-modified managed files.
- Reports remaining files that were intentionally not removed.

3. `Codex Onboarding: Repair`
- Repairs missing/corrupt managed state and managed-file consistency.
- Rebuilds managed state from selected target/bundle contract.

## Install Prompt Model
1. `Installation Scope`
- Select workspace root in multi-root contexts.

2. `Project Profile` (dynamic)
- Load from questionnaire definitions and do not hardcode in command handlers.

3. `Review & Apply: Git Tracking`
- Ask whether managed files should be tracked in Git or ignored via repository-local `.git/info/exclude` only when Git repository exists at selected root.

4. `Review & Apply`
- Final confirmation with concise summary and topic preview before changes are written.

## Command Policy
- No broad option explosion in command palette.
- Update behavior is lifecycle logic under install/repair flows, not a separate user command.
- Issue escalation actions are optional UI quick actions, not additional command-palette commands.
- Project profile questions are dynamic data-driven flows, not separate commands.
- All commands must produce deterministic operation reports.
