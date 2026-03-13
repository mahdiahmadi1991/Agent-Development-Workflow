# Product Living Spec

## Purpose
Keep a continuously synchronized, high-clarity specification of the final product goal and current planning boundaries.

## Final Product Goal
Build a VS Code extension that applies Codex onboarding files to a user's current project based on selected project type.

## User Flow (Target Behavior)
1. User runs the extension command in VS Code.
2. Extension asks Operational Questions required for safe execution context.
3. Extension loads Profile Selection Questions dynamically from questionnaire files.
4. User selects the target project/profile path through the question flow.
5. Extension presents behavior-impact summary and requires explicit acknowledgement.
6. Extension copies predefined onboarding files for that target into predefined paths in the current project.
7. Extension shows a success message with a summary of applied files.
8. Extension opens a dedicated post-install guidance page in VS Code with quick-start usage tips.
9. Extension exposes optional, user-controlled issue escalation actions for onboarding conflicts.

## Command Surface
- Minimal command set:
  - `Install Onboarding`
  - `Remove Onboarding`
  - `Repair Onboarding`
- Lifecycle update/sync behavior is part of install/repair logic, not a separate user command.
- Before install/apply actions, user must have access to a concise behavior-and-impact summary.

## Update Consent and Transparency
- Extension must notify user when a newer onboarding bundle/version is available.
- Update application must be explicit user action (no silent auto-apply).
- User must be able to review changelog/release notes before confirming update.
- Backward compatibility is a mandatory constraint for managed update behavior.

## Option Model (Dynamic Catalog)
Options must be dynamically sourced from a catalog model, not hardcoded as a fixed one-off flow.

Catalog design principles:
- Group options by ecosystem and language/runtime.
- Do not bias taxonomy toward ad-hoc example lists.
- Merge project-type options when Codex behavior requirements are equivalent.
- Split options only when behavioral policy differences are real and meaningful.

## Question System Model
- Question flow is split into two groups:
  - Operational Questions: extension behavior/runtime choices.
  - Profile Selection Questions: data-driven selection questions for profile/topic composition.
- Profile Selection Questions question definitions are loaded dynamically from:
  - `codex-onboarding/library/questionnaires/index.yaml`
  - `codex-onboarding/library/questionnaires/<family>/install-flow.yaml`
- Profile Selection Questions must not be hardcoded in extension command handlers.

## Instruction Asset Model
- Instruction assets are modular and topic-based.
- Each technical topic should be represented as its own file.
- Topic files must declare applicability (where they apply) so selection is data-driven.

Examples of applicability intent:
- Technology-specific topic files apply only to matching targets (e.g., EF guidance for `.NET` backend, not frontend).
- Cross-cutting topic files apply to multiple targets (e.g., repository management principles for frontend and backend).

## File Selection and Composition Mechanism
- User target selection is resolved against applicability metadata.
- Resolver composes the final file set from:
  - target-specific topics
  - cross-cutting shared topics
  - mandatory baseline topics
- Composed files are placed into predefined onboarding paths in the consumer project.
- Resolver must provide a deterministic `why-selected` preview before apply.

## Asset Library Storage Model
- Onboarding source assets are stored under `codex-onboarding/library/`.
- Storage is split into: `topics/`, `profiles/`, `questionnaires/`, `rules/`, `indexes/`.
- `indexes/topics.index.yaml` is the single source of truth for selectable topic assets.
- Topic files not present in index are invalid (orphan).
- Index entries pointing to missing files are invalid (broken index).

## Target Paths in Consumer Projects
- Baseline onboarding root: `codex-onboarding/`
- Managed core path: `codex-onboarding/core/`
- Project override path: `codex-onboarding/overrides/`

## Static Bootstrap Artifact
- A mandatory static onboarding file is always installed:
  - `codex-onboarding/core/AGENT-ONBOARDING.md`
- Purpose: generic Codex onboarding orientation for any selected target.
- The file is business-neutral and target-independent.
- Root `AGENTS.md` must not be auto-modified if already present.
- AGENTS linkage is user-controlled through optional reference snippets.

## Safety Policy for File Application
- Default mode is non-destructive.
- Existing files are not overwritten.
- Extension reports skipped files and completion summary.
- Read-only hardening is optional and `opt-in`.
- User can choose whether managed onboarding paths are added to Git ignore rules.

## Managed Ownership and Update Model
- Extension manages only files it owns under managed onboarding paths.
- Managed-file updates are version-aware and bundle-aware.
- Update operation must stop if a managed file was modified by the consumer.
- If extension version changes, all managed files must be synchronized to the new extension version, even when semantic content is unchanged.
- If managed files are already aligned with target bundle and extension version, operation ends as `already up-to-date`.
- Optional read-only marking may be used as a hardening layer, but integrity checks remain authoritative.
- For managed text files, version metadata markers use `comment block` format.

Recommended control metadata (managed state):
- `bundle_id`
- `bundle_version`
- `extension_version`
- managed file list with per-file digest (e.g., `sha256`)

Update decision flow:
1. Load managed state.
2. Evaluate current file digests against recorded state digests.
3. If drift is detected in managed files, stop update and report.
4. If extension version changed, notify user and show release notes/changelog before confirmation.
5. If user approves, synchronize all managed files to the new version markers and rewrite managed state.
6. If target bundle and extension version already match, skip write and finish.
7. Otherwise, update only managed files and rewrite managed state.

Downgrade behavior:
- Downgrade is supported only with the same ownership and integrity constraints.
- If downgrade safety checks fail, operation must stop with actionable diagnostics.

## Issue Escalation Model
- If a policy/content conflict is detected, user must be offered:
  - local override path
  - optional upstream issue escalation path
- Upstream issue escalation is explicit user action only.
- No silent automatic issue creation.
- Issue drafts should be pre-filled with deterministic diagnostics and redaction-safe context.
- If user confirms and required GitHub permissions are available, Codex may submit the issue directly.
- If permissions are missing or submission fails, flow must fallback to manual submission with prepared draft.

## Operational Roadmap Reference
- Execution roadmap: `docs/product/implementation-roadmap.md`
- Managed protection strategy: `docs/product/managed-file-protection.md`
- Managed state contract: `docs/product/managed-state-contract.md`
- Onboarding template standard: `docs/product/onboarding-template-standard.md`
- Onboarding template proposal archive: `docs/product/onboarding-template-proposal.md`
- Asset library storage standard: `docs/product/asset-library-storage-standard.md`
- Selection and resolution standard: `docs/product/selection-resolution-standard.md`
- Question model contract: `docs/product/question-model-contract.md`
- Topics index contract: `docs/product/topics-index-contract.md`
- Scenario matrix: `docs/product/scenario-matrix.md`
- Command surface contract: `docs/product/command-surface.md`
- Platform compatibility requirements: `docs/product/platform-compatibility.md`
- Environment support matrix: `docs/product/environment-support-matrix.md`
- Testing strategy: `docs/product/testing-strategy.md`
- Operation logging spec: `docs/product/operation-logging-spec.md`
- Recovery policy: `docs/product/recovery-policy.md`
- Update consent policy: `docs/product/update-consent-policy.md`
- Privacy and telemetry policy: `docs/product/privacy-telemetry-policy.md`
- Pre-install transparency contract: `docs/product/pre-install-transparency.md`
- Post-install success experience: `docs/product/post-install-success-experience.md`
- Static bootstrap onboarding file contract: `docs/product/bootstrap-onboarding-file-contract.md`
- Issue escalation policy: `docs/product/issue-escalation-policy.md`
- Consumer behavior summary: `docs/consumer/README.md`
- Consumer AI quickstart prompts: `docs/consumer/AI-Quickstart.md`
- Git tracking option policy: `docs/product/git-tracking-option.md`
- Release documentation policy: `docs/product/release-documentation-policy.md`
- Publisher release runbook: `docs/product/publisher-release-runbook.md`
- Marketplace readiness checklist: `docs/product/marketplace-readiness-checklist.md`
- Release rehearsal reports: `docs/releases/rehearsals/README.md`

## Current Active Scope
- Codex-only onboarding.
- English-only artifacts.
- Current phase: extension infrastructure and behavior implementation.
- Cross-platform support is required (Windows, WSL, Linux, macOS).
- Root resolution is smart: single-root auto-select, multi-root prompt, no workspace file requirement.
- Testing and CI/CD quality gates are mandatory.
- Trace-level operation logging is mandatory for install/remove/repair.
- Release notes and changelog are mandatory for each release.
- Release version must align with extension package version before publish.
- Release flow stages are mandatory: validate/package first, then optional publish actions.
- Release-note authoring uses scaffolded template with decision-reference section.
- Local release rehearsal evidence is required before first public publish sign-off.
- Post-install guidance page is mandatory after successful install.
- Onboarding file structure is locked by template standard and validator gate.
- Library storage and selection contracts are locked by validator gate.
- Static bootstrap onboarding artifact is mandatory in every install/repair result.
- Conflict-report escalation path is optional and fully user-controlled.
- Dynamic two-group question model is mandatory for install/repair flow behavior.
- Execution gate is strict: no implementation action without explicit user execution command.
- Implementation cadence is review-gated: one step per cycle, then stop for review and approval before commit and next step.
- Governance decisions must ignore extension artifact roots as policy sources.

## Deferred Scope
- Onboarding topic content authoring.
- Release and distribution strategy details beyond managed-file update logic.
- Concurrent operation locking, unless conflict evidence requires prioritization.

## Decision Synchronization Rule
After each planning conversation:
1. Update this file if product behavior or boundaries changed.
2. Append or update entries in `docs/product/decision-log.md`.
3. Reflect permanent governance impact in `docs/governance/working-agreement.md` and `AGENTS.md`.
