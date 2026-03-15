# Static Bootstrap Onboarding File Contract

## Goal
Define a mandatory, generic, always-installed bootstrap artifact that introduces Codex to the onboarding system in consumer projects.

## Mandatory Artifact
- Path: `.codex-onboarding/AGENTS.md`
- Type: managed core artifact.
- Install policy: always included in every install/repair composition.
- Content policy: generic and project-type independent.

## Mandatory Discovery Artifact
- Path: `.codex-onboarding/INDEX.md`
- Type: managed core artifact.
- Install policy: always included in every install/repair composition.
- Purpose: deterministic low-noise onboarding entry point and read-order contract for Codex.

## Content Contract
The file must remain stable and business-neutral. Required sections:
1. Purpose and scope of Codex onboarding assets.
2. Managed vs override paths and ownership boundaries.
3. Policy hierarchy summary and conflict resolution order.
4. Entry-point reference to `.codex-onboarding/INDEX.md`.
5. How to ask Codex to use installed onboarding assets effectively.
6. Non-destructive lifecycle behavior summary (install/update/remove/repair).
7. Where to report policy conflicts or quality issues.
8. Index references to any managed supporting guidance files.

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
- If root `AGENTS.md` does not exist, install creates it automatically with a pointer to `.codex-onboarding/INDEX.md`.
- If root `AGENTS.md` exists, extension must ask explicit user permission before editing it.
- If permission is denied, root `AGENTS.md` stays unchanged and post-install page must provide a manual snippet for user paste.
- Core onboarding behavior must remain functional even when root `AGENTS.md` is unchanged.
- On successful `repair` and `remove`, extension cleans extension-managed pointer content from root `AGENTS.md` when present.

## Safety Constraints
- No overwrite of consumer-authored files.
- Existing non-managed root artifacts require explicit user consent before edit.

## Governance
Any change to this contract requires:
1. Explicit approval.
2. `decision-log` update.
3. `living-spec` synchronization.
