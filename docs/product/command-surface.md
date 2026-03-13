# Command Surface (Minimal)

## Goal
Keep extension UX minimal and predictable while preserving safe lifecycle control.

## User-Facing Commands
1. `Install Onboarding`
- Installs managed onboarding files for selected target.
- Runs synchronization logic when managed state already exists.
- If update is available, surfaces changelog/release notes and proceeds only after explicit confirmation.
- Must present or link a pre-install behavior summary before applying changes.
- Must offer Git tracking choice for managed paths (`add to .gitignore` or keep tracked).
- On success, must show summary notification and open dedicated post-install guidance page.

2. `Remove Onboarding`
- Clears managed state.
- Removes extension-owned managed files only when they are unchanged from managed integrity state.
- Never deletes unmanaged consumer files or consumer-modified managed files.
- Reports remaining files that were intentionally not removed.

3. `Repair Onboarding`
- Repairs missing/corrupt managed state and managed-file consistency.
- Rebuilds managed state from selected target/bundle contract.

## Command Policy
- No broad option explosion in command palette.
- Update behavior is lifecycle logic under install/repair flows, not a separate user command.
- Issue escalation actions are optional UI quick actions, not additional command-palette commands.
- Profile Selection Questions project/topic questions are dynamic data-driven flows, not separate commands.
- All commands must produce deterministic operation reports.
