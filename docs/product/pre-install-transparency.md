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
- Post-install experience (success summary + dedicated guidance page behavior).
- Git tracking option (add managed paths to `.gitignore` or not).
- Supported, tested, and unsupported runtime environments.
- Mandatory static bootstrap onboarding artifact path and role.
- Conflict-escalation path (optional upstream issue reporting as user-controlled action).
- Issue-submission modes: permission-aware direct submit (with explicit confirmation) and manual fallback.
- Question model visibility: Operational questions vs Profile Selection questions.

## Required Documentation Artifact
- A concise, consumer-facing summary must be maintained and synced with current behavior.
- This summary must be available in repository docs and reachable from extension UI flow.
- Canonical summary file: `docs/consumer/README.md`

## UX Requirement
Before install/apply execution:
1. Show summary link or inline summary.
2. Require explicit user acknowledgement.
3. Proceed only after acknowledgement.

## Governance Rule
Any behavior-impact change must update this transparency summary in the same planning/update cycle.
