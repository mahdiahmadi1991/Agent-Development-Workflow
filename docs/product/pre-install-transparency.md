# Pre-Install Transparency Contract

## Goal
Ensure users can review extension behavior and impact before onboarding files are applied.

## Required User Visibility Before Install
- What files are managed by the extension.
- Where managed files are placed in the project.
- Non-destructive behavior and ownership boundaries.
- Update synchronization behavior on extension upgrades.
- Update consent flow and changelog/release-note review path.
- Drift detection and stop conditions.
- Available lifecycle commands: install, remove, repair.
- Output visibility model: Output auto-opens on operation failure; success/cancel flows do not force Output focus.
- Post-install experience (success summary + dedicated WebviewPanel behavior).
- Git tracking option (track in Git or ignore via repository-local `.git/info/exclude`).
- If ignore mode is selected, post-install summary must explain ignore mechanism and explicit opt-out path.
- If selected root has no Git repository, Git tracking question is skipped as not applicable.
- Root `AGENTS.md` integration behavior:
  - auto-create when missing,
  - explicit permission gate when file already exists,
  - manual snippet fallback in post-install page when permission is denied.
- Supported, tested, and unsupported runtime environments.
- Mandatory static bootstrap onboarding artifact path and role.
- Conflict-escalation path (optional upstream issue suggestion as user-controlled action).
- Advisory guidance file path for conflict escalation: `.codex-onboarding/ISSUE-REPORTING.md`.
- Root `AGENTS.md` cleanup behavior on repair/remove for extension-managed pointer content.
- Question model visibility: Operational questions vs Profile Selection questions.
- Selection explainability visibility before apply (selected topics + reason tags).

## Required Documentation Artifact
- A concise, consumer-facing summary must be maintained and synced with current behavior.
- This summary must be available in repository docs and reachable from extension UI flow.
- Canonical summary file: `docs/consumer/README.md`

## UX Requirement
Before install/apply execution:
1. Show summary link or inline summary.
2. Show selection explainability preview (at minimum: selected topic count + reason-tag visibility, with details available on demand).
3. Require explicit user acknowledgement.
4. Proceed only after acknowledgement.

## Governance Rule
Any behavior-impact change must update this transparency summary in the same planning/update cycle.
