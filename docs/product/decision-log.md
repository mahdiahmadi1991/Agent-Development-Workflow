# Decision Log

This file records accepted planning decisions and open decisions.

## Accepted Decisions
| ID | Decision | Status | Notes |
|---|---|---|---|
| D-001 | Repository scope is Codex-only onboarding. | Accepted | No multi-agent target in this project. |
| D-002 | Project artifacts are English-only. | Accepted | Applies to governance and onboarding assets. |
| D-003 | No commit/push without explicit user approval. | Accepted | Applies to all phases. |
| D-004 | Every implementation requires prior design double-check and explicit approval. | Accepted | Planning first, execution after approval. |
| D-005 | Current phase focuses on project structure and onboarding architecture. | Superseded | Replaced by D-062. |
| D-006 | Versioning is out of scope in current phase. | Superseded | Replaced by managed-file versioning scope in D-015. |
| D-007 | Final product is a VS Code extension that applies onboarding files based on selected project type. | Accepted | Target behavior locked for planning. |
| D-008 | Extension options must be dynamic; | Accepted | Future targets can be added via catalog. |
| D-009 | Option taxonomy is standards-driven and behavior-based, not biased by ad-hoc examples. | Accepted | Merge equivalent project types to reduce complexity. |
| D-010 | Consumer destination root is `.codex-onboarding/`. | Accepted | Includes `core/` and `overrides/` paths. |
| D-011 | File application policy is non-destructive by default. | Accepted | No overwrite of existing consumer files. |
| D-012 | Instruction files are modular: one file per technical topic. | Accepted | Topic-level granularity is required. |
| D-013 | Applicability metadata determines where each topic file is used. | Accepted | Enables target-specific and shared-topic composition. |
| D-014 | Final file set is composed from target-specific + cross-cutting + mandatory baseline topics. | Accepted | Composition is selection-driven. |
| D-015 | Managed-file versioning is in scope for safe update and synchronization. | Accepted | Applies only to extension-owned onboarding files. |
| D-016 | Update must stop on managed-file drift (consumer edits detected). | Accepted | Fail-fast to avoid unintended overwrite. |
| D-017 | Up-to-date detection must skip writes and complete with explicit status. | Accepted | Prevent unnecessary file rewrites. |
| D-018 | Extension update scope is limited to extension-owned managed files. | Accepted | Ownership boundary is strict. |
| D-019 | File-attribute read-only protection is optional hardening, not primary integrity control. | Accepted | Digest-based integrity remains source of truth. |
| D-020 | On extension version upgrade, all managed files must be synchronized, even if semantic content is unchanged. | Accepted | Version sync is explicit and mandatory. |
| D-021 | Managed state in `.codex-onboarding/.managed/state.json` is the authoritative update-control record. | Accepted | Includes file ownership and digest tracking. |
| D-022 | File-level metadata markers are preferred for managed text files; state remains authoritative. | Accepted | Embedded markers plus state traceability. |
| D-023 | CI/CD must validate contracts, scenario behavior, and release integrity before publishing. | Accepted | Pipeline is a first-class requirement. |
| D-024 | Extension branding assets (logo, icon, description copy) are part of product infrastructure scope. | Accepted | Must be planned before release readiness. |
| D-025 | Extension must support Windows, WSL, Linux, and macOS VS Code environments. | Accepted | Cross-platform behavior is mandatory. |
| D-026 | Testing is mandatory across unit, integration, scenario, and cross-platform layers. | Accepted | No release without passing quality gates. |
| D-027 | Command surface remains minimal: `install`, `remove`, `repair`. | Accepted | Update sync stays internal lifecycle behavior. |
| D-028 | Install/remove/repair operations must emit trace-level structured logs. | Accepted | Deterministic diagnostics required. |
| D-029 | Recovery policy must include fail-fast stop, repair, and explicit reinstall modes. | Accepted | Only extension-owned files are in scope. |
| D-030 | Privacy baseline is local-first diagnostics with no outbound telemetry by default. | Accepted | Any future telemetry is explicit opt-in only. |
| D-031 | Managed text-file metadata header format is `comment block`. | Accepted | Chosen for broad cross-file compatibility. |
| D-032 | Read-only hardening mode is `opt-in`. | Accepted | Prevents default workflow friction across environments. |
| D-033 | Multi-root behavior is smart detection: prompt only when multiple roots are present. | Accepted | Single-root uses default root automatically. |
| D-034 | No-workspace-file sessions must still be supported using the opened folder as root context. | Accepted | Workspace file is not required for operation. |
| D-035 | A consumer-facing pre-install behavior summary document must be maintained and shown before apply actions. | Accepted | No surprise policy for behavior and impact. |
| D-036 | Trace logs must include severity levels (`debug`, `warning`, `error`). | Accepted | Required for actionable diagnostics. |
| D-037 | Current state requires no outbound telemetry. | Accepted | Local diagnostics only in this stage. |
| D-038 | Update application is explicit user action after update notification and changelog review. | Accepted | No silent auto-apply updates. |
| D-039 | User can choose whether managed onboarding paths are tracked in Git or ignored via repository-local Git metadata. | Accepted | Git tracking mode is user-configurable without editing project files. |
| D-040 | Every release must include release notes and changelog updates. | Accepted | Mandatory release documentation. |
| D-041 | Downgrade is allowed only under the same integrity and ownership safeguards as upgrade. | Superseded | Superseded by D-090 for current pre-release phase. |
| D-042 | Remove command must clear managed state and delete only untouched managed files. | Superseded | Replaced by D-083 remove impact-scan + destructive-confirm model. |
| D-043 | Each lifecycle operation must write a dedicated unique trace log file. | Accepted | One log file per install/remove/repair run. |
| D-044 | Supported and tested environments must be documented explicitly in user-facing docs. | Accepted | Avoid hidden compatibility assumptions. |
| D-045 | Concurrent operation locking is deferred until a real conflict signal is observed. | Accepted | Not in current implementation scope. |
| D-046 | Successful install must show a concise completion notification in VS Code. | Accepted | Includes operation summary highlights. |
| D-047 | Successful install must open a dedicated post-install page in VS Code. | Accepted | Rendering contract is specified as WebviewPanel by D-075. |
| D-048 | Post-install page must include AI interaction quick-start tips tied to installed onboarding assets. | Accepted | Reduces onboarding friction for end users. |
| D-049 | Onboarding file structure is fixed by a canonical template standard. | Accepted | Ensures stable structure for future generated assets. |
| D-050 | Template compliance validation is mandatory in local and CI governance checks. | Accepted | Blocks non-compliant onboarding file generation. |
| D-051 | Onboarding source assets must be stored under a fixed library taxonomy. | Accepted | Prevents future repository clutter and drift. |
| D-052 | Topics index is the single source of truth for selectable topic assets. | Accepted | Orphan and broken-index states are invalid. |
| D-053 | Selection resolver must be deterministic and explainable (`why-selected` preview). | Accepted | Same inputs must produce same ordered output set. |
| D-054 | Selection pipeline must use profile baseline + questionnaire capabilities + dependency/conflict resolution. | Accepted | Supports minimal required file-set composition. |
| D-055 | Library storage and selection contracts are validator-enforced in local and CI checks. | Accepted | Non-compliant layout or metadata blocks validation. |
| D-056 | A mandatory static bootstrap onboarding file must be installed in every target project. | Accepted | Canonical path: `.codex-onboarding/AGENTS.md`. |
| D-057 | Static bootstrap onboarding content must remain generic and target-independent. | Accepted | No project-type-specific content in this artifact. |
| D-058 | Root `AGENTS.md` integration is user-controlled for existing files; extension may auto-create root `AGENTS.md` when missing. | Accepted | Existing root file edits require explicit runtime permission; missing root file is created automatically with onboarding pointer snippet. |
| D-059 | Onboarding conflict reporting must use explicit user-controlled issue escalation only. | Accepted | No silent automatic external issue creation. |
| D-060 | Issue escalation should use pre-filled, redaction-safe diagnostics payloads for user review before submission. | Accepted | Includes version/profile/log references, not raw sensitive content. |
| D-061 | Codex may submit upstream issues directly using user-granted GitHub permissions after explicit per-submit confirmation. | Accepted | If permission/check fails, fallback is manual submission with prepared draft. |
| D-062 | Current phase scope is extension infrastructure and behavior implementation; onboarding topic content authoring is deferred. | Accepted | Enables execution work without content-authoring scope creep. |
| D-063 | Extension question system has two groups: operational questions (static behavior) and profile/topic questions (dynamic, file-driven). | Accepted | Profile Selection Questions must be loaded from questionnaire definition files, not hardcoded. |
| D-064 | Product behavior rules use `decision-log` as canonical source to reduce duplicated rule lists across governance files. | Accepted | `AGENTS.md` and `working-agreement.md` keep summarized constraints and references. |
| D-065 | Documentation drift control is mandatory via source-of-truth ownership + validator gates + coverage parity checks. | Accepted | Defined in `docs/governance/drift-control.md`. |
| D-066 | Idea approval is not implementation approval; implementation requires explicit execution command from user. | Accepted | Violating this gate is a process failure. |
| D-067 | Governance-to-artifact boundary is mandatory: extension artifact roots are excluded as policy sources for agent onboarding decisions. | Accepted | Enforced by boundary map and boundary validator gate. |
| D-068 | Implementation proceeds in review-gated step cycles: implement one step, stop for review, then commit only after approval before next step. | Accepted | Mandatory process guard for all future execution turns. |
| D-069 | Release publishing is gated by release-doc validation, package-version parity, and artifact checksum generation before any optional publish action. | Accepted | Enforced by release validation and publish workflows. |
| D-070 | Release-note authoring is scaffolded from changelog into a fixed template that includes decision references. | Accepted | Enforced by release-doc section validation and scaffold script workflow. |
| D-071 | Publisher-side release operations must follow a maintained runbook aligned with release workflows and secret requirements. | Accepted | Canonical runbook: `docs/product/publisher-release-runbook.md`. |
| D-072 | Branding baseline is locked with packaged icon assets and marketplace-readiness checklist gates. | Accepted | Icon assets are versioned under `packages/vscode-extension/assets/branding/`. |
| D-073 | A local end-to-end release rehearsal script and evidence report are required before first public publish sign-off. | Accepted | Script: `scripts/rehearse-release-local.sh`; reports under `docs/releases/rehearsals/`. |
| D-074 | Published VSIX must be self-contained for runtime config loading: onboarding assets and YAML runtime dependency must be packaged with the extension. | Accepted | Enforced by package file inclusion and sync script before compile/package. |
| D-075 | Post-install guidance experience must use a static-structure WebviewPanel with deterministic section order and runtime summary injection. | Accepted | Execution is phase-split in `docs/product/post-install-success-experience.md`; fallback must not fail install. |
| D-076 | Post-install Webview must follow a professional V1 UX baseline: Outcome Snapshot, Before/After Map, First 3 Steps, Prompt Packs, Safe Boundaries, Lifecycle Playbook, Change Report, and Action Bar; `Git Tracking Details` is conditional. | Accepted | `Git Tracking Details` appears only when ignore mode is selected and applied. |
| D-077 | Update consent gate requires explicit review of both release notes and changelog before `Continue Update` is accepted. | Accepted | Applies to install update paths; no silent or one-click bypass. |
| D-078 | Git tracking question is asked only when selected root is a Git repository; otherwise it is skipped as not applicable. | Accepted | Avoids presenting irrelevant ignore/track choice in non-Git projects. |
| D-079 | Repair command is valid only when prior managed onboarding evidence exists in selected workspace root. | Accepted | If evidence is missing, repair is blocked and user is directed to run install first. |
| D-080 | Repair flow has no extra post-question confirmation gate. | Accepted | After required questions and checks, repair proceeds directly under non-destructive safeguards. |
| D-081 | Repair command must be state-driven and restore only the currently recorded managed bundle/version in consumer state. | Accepted | Repair must not ask profile-selection flow or change bundle/profile selection. |
| D-082 | Repair must detect managed drift by state digests; if drift exists, destructive reset requires explicit QuickPick confirmation. | Accepted | User-added untracked files are not treated as managed edits. |
| D-083 | Remove command must run impact scan first; clean roots remove without prompt, and detected drift/additional files require destructive QuickPick confirmation before full `.codex-onboarding/` deletion. | Accepted | Aligns remove UX with repair-style explicit destructive confirmation while preserving fast path for clean roots. |
| D-084 | Repair may recover managed source metadata from intact managed files when managed state is missing/corrupt/empty, then rebuild state through repair flow. | Accepted | If no managed evidence exists, repair remains blocked and install-first guidance is shown. |
| D-085 | Issue escalation must be delivered as managed advisory guidance (`.codex-onboarding/ISSUE-REPORTING.md`) instead of dedicated extension runtime submission flows. | Accepted | Extension remains non-destructive and local-first; Codex may only suggest escalation and offer user-approved help. |
| D-086 | Onboarding asset source-of-truth is `.codex-onboarding/**`; extension `onboarding-assets/**` is generated mirror that must stay byte-synchronized via sync/verify gates. | Accepted | Prevents dual-source drift while keeping VSIX self-contained at runtime. |
| D-087 | Install flow must detect root `AGENTS.md` and request edit permission when it already exists; if permission is denied, post-install page must provide a manual snippet for user paste. | Accepted | Keeps existing root ownership user-controlled while preserving onboarding discoverability. |
| D-088 | VS Code Output channel should open automatically only on operation failure (not at command start). | Accepted | Reduces focus interference/noise during normal interactive flows while still surfacing diagnostics when needed. |
| D-089 | Repair and Remove must clean extension-managed pointer content from root `AGENTS.md` when present. | Accepted | Cleanup is best-effort and supports current marker-based pointer format only. |
| D-090 | Until first public release exists, backward-compatibility and legacy-support requirements are out of scope. | Accepted | Do not add legacy code paths in this phase unless explicitly approved in a separate decision. |
