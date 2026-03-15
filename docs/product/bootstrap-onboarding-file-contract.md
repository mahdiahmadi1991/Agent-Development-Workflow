# Static Bootstrap Onboarding File Contract

## Goal
Define a mandatory, generic, always-installed bootstrap artifact that introduces Codex to the onboarding system in consumer projects.

## Mandatory Artifact
- Path: `.codex-onboarding/AGENTS.md`
- Type: managed core artifact.
- Install policy: always included in every install/repair composition.
- Content policy: generic and project-type independent.

## Content Contract
The file must remain stable and business-neutral. Required sections:
1. Purpose and scope of Codex onboarding assets.
2. Managed vs override paths and ownership boundaries.
3. Policy hierarchy summary and conflict resolution order.
4. How to ask Codex to use installed onboarding assets effectively.
5. Non-destructive lifecycle behavior summary (install/update/remove/repair).
6. Where to report policy conflicts or quality issues.
7. Index references to any managed supporting guidance files.

## Managed Supporting Guidance
- Path: `.codex-onboarding/ISSUE-REPORTING.md`
- Type: managed core artifact.
- Install policy: always included in every install/repair composition.
- Purpose: advisory guidance that trains Codex to suggest user-controlled upstream issue escalation when conflict persists.
- Runtime policy: no dedicated extension command or automatic network submission is required by this contract.

## Metadata Contract
- Managed text metadata header format: `comment block`.
- Required metadata keys:
  - `artifact_id`
  - `managed`
  - `schema_version`
  - `bundle_id`
  - `bundle_version`
  - `extension_version`

## AGENTS Integration Policy
- Extension must not modify a pre-existing root `AGENTS.md`.
- If root `AGENTS.md` exists, extension provides a safe reference snippet only (manual adoption by user).
- If root `AGENTS.md` does not exist, creating one is optional user action, not implicit auto-write.
- Core onboarding behavior must remain functional without requiring root `AGENTS.md` mutation.

## Safety Constraints
- No overwrite of consumer-authored files.
- This contract does not grant permission to edit non-managed root artifacts automatically.

## Governance
Any change to this contract requires:
1. Explicit approval.
2. `decision-log` update.
3. `living-spec` synchronization.
