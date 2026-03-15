# VS Code Extension Architecture (Planning Baseline)

## Goal
Define the planned behavior for a VS Code extension that applies Codex onboarding structures into target projects.

## Product-Level Behavior
1. User triggers extension command.
2. Install flow asks Operational questions required for runtime behavior.
3. Install flow loads Profile Selection question flow dynamically from questionnaire files.
4. Extension resolves selected target.
5. Install flow presents pre-install behavior summary and receives explicit acknowledgement.
6. Install/repair flows offer Git tracking mode choice for managed paths.
7. Extension applies predefined onboarding files into `.codex-onboarding/` paths.
8. Extension follows non-destructive apply mode (no overwrite of existing files).
9. Extension reports success, applied files, and skipped files summary.
10. Extension opens a dedicated post-install WebviewPanel with the fixed V1 section baseline, quick-start usage tips, and runtime change summary.
11. Extension installs managed advisory guidance for user-controlled issue escalation recommendations.

## Command Surface
- `Install Onboarding`
- `Remove Onboarding`
- `Repair Onboarding`
- `Remove` clears managed state and removes only unchanged managed files.

## Managed Update Behavior
- Extension manages only extension-owned onboarding files.
- Managed state tracks bundle and file digest data.
- Update operation is fail-fast on managed-file drift.
- On extension version upgrade, managed files are synchronized even when semantic content is unchanged.
- Update requires explicit user confirmation after release-note/changelog visibility.
- If bundle and extension version are already synchronized, update exits without rewriting files.
- Update never modifies unrelated files in the consumer project.

## Option Taxonomy Principles
- Taxonomy is standards-driven and behavior-based.
- Behaviorally equivalent project types should be merged.
- New sub-options are introduced only for meaningful behavior differences.

## Instruction Selection Principles
- Instruction content is topic-based (one file per technical topic).
- Each topic file carries applicability constraints.
- Resolver composes final output by combining:
  - target-specific topics
  - cross-cutting shared topics
  - mandatory baseline topics
- Source topics are loaded from `.codex-onboarding/library/` with `topics.index.yaml` as authoritative index.
- Resolver must produce deterministic output with explainability preview (`why-selected`).

## Question System
- Operational questions are extension-defined.
- Install Profile Selection questions are file-driven and dynamic.
- Profile Selection Questions source files:
  - `.codex-onboarding/library/questionnaires/index.yaml`
  - `.codex-onboarding/library/questionnaires/<family>/install-flow.yaml`
- Install Profile Selection question flows must not be hardcoded in extension command logic.
- Repair flow is state-driven and uses existing managed state as source of truth.

## Static Bootstrap Artifact
- Every install/repair must include `.codex-onboarding/AGENTS.md`.
- The artifact content is generic and target-independent.
- If root `AGENTS.md` is missing, install auto-creates it with onboarding pointer guidance.
- If root `AGENTS.md` already exists, edit requires explicit user permission in install flow.

## Conflict Escalation Principle
- Escalation to upstream issue reporting is optional and user-controlled.
- No silent automatic external issue creation is allowed.
- Guidance is delivered through managed artifacts (not a dedicated extension command surface).
- Codex may offer draft/help in user-controlled environments only after explicit user request.

## Planning Constraints
- Current phase focuses on extension infrastructure and behavior implementation planning.
- Managed-file versioning for extension-owned assets is in scope.
- Onboarding topic content authoring is deferred.

## Cross-Platform Requirement
- Behavior must be consistent in VS Code on Windows, WSL, Linux, and macOS.
- Extension must work when no `.code-workspace` file is present.
- Root resolution must auto-select single-root and prompt on multi-root.

## Quality Requirement
- Test strategy must include unit, integration, scenario, and cross-platform lanes.
- Post-install UX tests must verify fixed section order, Prompt Packs availability, and Action Bar behavior.
- Install/remove/repair flows must emit trace-level structured logs for diagnostics with `debug`/`warning`/`error` severities.
