# Implementation Gap Audit (2026-03-14)

## Purpose
Record the current gaps between accepted product/governance contracts and the actual VS Code extension implementation.

## Audit Scope
- Product contracts under `docs/product/*`
- Governance contracts under `AGENTS.md` and `docs/governance/*`
- Current extension implementation under `packages/vscode-extension/src/*`
- Current CI/release workflows under `.github/workflows/*` and `scripts/*`

## Executive Summary
The extension foundation is stable (commands, managed state, non-destructive defaults, post-install webview, trace logs), and previously identified high-impact contract gaps in this audit scope are now resolved.

Current status:
1. No open unresolved findings remain from this audit list.
2. New work should start from a fresh delta audit against future decisions/contract changes.

## Findings

### F-01: Git tracking mode is now runtime-enforced via Git metadata (Resolved)
- Severity: Resolved
- Contract references:
  - `docs/product/git-tracking-option.md`
  - `docs/product/decision-log.md` (D-039)
- Implementation evidence:
  - Choice captured in `packages/vscode-extension/src/commands/installCommand.ts`
  - `packages/vscode-extension/src/services/gitTrackingService.ts` applies `track/ignore` in `.git/info/exclude`.
  - Install/repair/remove flows call the service to keep Git-tracking behavior synchronized.
- Resolution note:
  - Ignore behavior no longer edits consumer project files such as root `.gitignore`; it uses repository-local Git metadata.

### F-02: Update consent policy is runtime-enforced in install flow (Resolved)
- Severity: Resolved
- Contract references:
  - `docs/product/update-consent-policy.md`
  - `docs/product/scenario-matrix.md` (S-02, S-03, S-04)
  - `docs/product/decision-log.md` (D-038)
- Implementation evidence:
  - `packages/vscode-extension/src/services/updateConsentService.ts` checks managed-state version drift and enforces update gate.
  - Install command calls update-consent gate before apply operations.
  - Update gate requires opening both Release Notes and Changelog before `Continue Update`.
- Resolution note:
  - Update synchronization now requires explicit user approval after release-doc review; no silent apply path remains.

### F-03: Scenario S-06 behavior mismatch (missing managed file) (Resolved)
- Severity: Resolved
- Contract references:
  - `docs/product/scenario-matrix.md` (S-06)
- Implementation evidence:
  - `packages/vscode-extension/src/services/managedInstallService.ts` now preflights tracked managed files and blocks when tracked files are missing.
  - `packages/vscode-extension/src/scenarios/scenarioMatrix.smoke.spec.ts` includes explicit S-06 smoke coverage.
  - `packages/vscode-extension/src/services/__tests__/managedInstallService.spec.ts` includes no-partial-write assertion for missing tracked file failure.
- Resolution note:
  - First install still creates new files as expected.
  - Update/install with existing tracked state now fail-fast on missing tracked managed files.

### F-04: Repair flow does not handle corrupt state rebuild path fully (Resolved)
- Severity: Resolved
- Contract references:
  - `docs/product/scenario-matrix.md` (S-10)
  - `docs/product/recovery-policy.md`
- Implementation evidence:
  - `packages/vscode-extension/src/commands/repairCommand.ts` now handles `missing/corrupt` state as recoverable when managed files are intact.
  - `packages/vscode-extension/src/commands/repairCommand.spec.ts` covers missing/corrupt/empty-state recovery paths.
- Resolution note:
  - Repair reconstructs source metadata from managed files and rebuilds state in repair mode.
  - If managed evidence is absent, repair remains blocked with install-first guidance.

### F-05: Issue escalation behavior scope was over-implemented in runtime (Resolved)
- Severity: Resolved
- Contract references:
  - `docs/product/decision-log.md` (D-059, D-060, D-061, D-085)
  - `docs/product/bootstrap-onboarding-file-contract.md`
- Implementation evidence:
  - Runtime report-issue command and service were removed from extension code-path.
  - Managed advisory artifact `.codex-onboarding/ISSUE-REPORTING.md` was added.
  - `.codex-onboarding/AGENTS.md` now indexes the advisory artifact explicitly.
- Resolution note:
  - Escalation remains explicit and user-controlled as advisory guidance for Codex behavior, not extension-driven network submission logic.

### F-06: Dynamic option catalog target family hardcoded in install (Resolved)
- Severity: Resolved
- Contract references:
  - `docs/product/living-spec.md` (Option model)
  - `docs/product/decision-log.md` (D-008, D-009)
- Implementation evidence:
  - `packages/vscode-extension/src/services/questionnaireAssetService.ts` now parses questionnaire catalog from `index.yaml`.
  - `packages/vscode-extension/src/commands/installCommand.ts` resolves family dynamically from catalog and prompts only when multiple families exist.
- Resolution note:
  - Install no longer hardcodes a fixed family key.

### F-07: Questionnaire registry not truly resolved from index (Resolved)
- Severity: Resolved
- Contract references:
  - `docs/product/question-model-contract.md`
- Implementation evidence:
  - `packages/vscode-extension/src/services/questionnaireAssetService.ts` parses `index.yaml` as canonical registry.
  - `install_flow` path is resolved from registry entries instead of hardcoded family-path convention.
- Resolution note:
  - Questionnaire routing now follows catalog contract directly.

### F-15: Technology Selection Wizard was single-layer and not tree-capable (Resolved)
- Severity: Resolved
- Contract references:
  - `docs/product/dynamic-tree-install-wizard-proposal.md`
  - `docs/product/question-model-contract.md`
- Implementation evidence:
  - `packages/vscode-extension/src/services/questionnaireFlowRunner.ts` now runs dynamic tree traversal with `single`/`multi` nodes.
  - `packages/vscode-extension/src/services/questionnaireAssetService.ts` validates tree node contracts, rule expressions, and graph references.
  - `packages/vscode-extension/src/commands/installCommand.ts` consumes emitted wizard payload (`profile_hints`, capability tags, topic tags) without hardcoded profile question logic.
- Resolution note:
  - Install wizard behavior is now config-driven and progressive, with N-layer tree traversal and multi-select support.

### F-08: Explainability (`why-selected`) is not exposed to user before apply
- Severity: Resolved
- Contract references:
  - `docs/product/selection-resolution-standard.md`
- Implementation evidence:
  - `packages/vscode-extension/src/services/preInstallTransparencyService.ts` now shows compact explainability summary before apply and offers an explicit “Open Selection Explainability” details path.
  - `packages/vscode-extension/src/services/postInstallGuidancePage.ts` includes deterministic `Selection Explainability` section with per-topic reason tags.
- Resolution note:
  - Explainability is now visible both pre-apply (compact + details path) and post-install (full section).

### F-09: Pre-install transparency is only partially surfaced in UI
- Severity: Resolved
- Contract references:
  - `docs/product/pre-install-transparency.md`
- Implementation evidence:
  - `packages/vscode-extension/src/services/preInstallTransparencyService.ts` enforces transparency acknowledgement gate.
  - Gate includes canonical consumer summary open action and explainability details action.
  - Install flow blocks safely when acknowledgement is not granted.
- Resolution note:
  - Install now requires explicit transparency acknowledgement before any managed apply action.

### F-10: Operation logging required events are incomplete
- Severity: Resolved
- Contract references:
  - `docs/product/operation-logging-spec.md`
  - `docs/product/ci-cd-requirements.md`
- Implementation evidence:
  - `state_loaded` is emitted from install/remove/repair state-load paths.
  - `operational_question_asked` is emitted for repair/remove confirmations and install operational gates.
  - Logging contract updated to include `state_loaded` in required events list.
- Resolution note:
  - Required lifecycle events are now emitted across install/remove/repair command paths.

### F-11: Up-to-date short-circuit behavior does not match contract
- Severity: Resolved
- Contract references:
  - `docs/product/decision-log.md` (D-017)
  - `docs/product/scenario-matrix.md` (S-04)
- Implementation evidence:
  - `packages/vscode-extension/src/services/managedInstallService.ts` detects fully synchronized states and returns `already_up_to_date`.
  - No-op path skips state rewrite (`stateRewritten: false`).
  - `packages/vscode-extension/src/services/__tests__/managedInstallService.spec.ts` asserts no-write result path.
- Resolution note:
  - Fully synchronized runs now finish with explicit no-op status and no state rewrite.

### F-12: CI gates are narrower than declared CI/CD requirements
- Severity: Resolved
- Contract references:
  - `docs/product/ci-cd-requirements.md`
- Implementation evidence:
  - Added `scripts/validate-scenario-coverage.sh`.
  - `scripts/validate-governance.sh` now includes scenario-coverage validation.
  - `.github/workflows/vscode-extension-ci.yml` runs governance validation gate in CI.
- Resolution note:
  - CI and governance validators now enforce declared scenario-traceability and contract checks.

### F-13: Scenario matrix coverage is partial
- Severity: Resolved
- Contract references:
  - `docs/product/testing-strategy.md`
  - `docs/product/scenario-matrix.md`
- Implementation evidence:
  - Added canonical traceability map: `docs/product/scenario-coverage-map.yaml`.
  - Coverage map references automated/deferred coverage per scenario ID.
  - Scenario-map parity is validated by `scripts/validate-scenario-coverage.sh`.
- Resolution note:
  - Scenario coverage is now contract-traceable and CI-enforced via mapping parity checks.

### F-14: Documentation drift in command naming and phase wording
- Severity: Resolved
- Contract references:
  - `docs/product/decision-log.md` (D-064, D-065)
- Implementation evidence:
  - Updated command naming in product/consumer/architecture docs to `Codex Onboarding: <Action>`.
  - Updated phase wording to implementation/stabilization in governance/product summary docs.
- Resolution note:
  - Command vocabulary and phase wording are now synchronized with runtime behavior.

## Completed vs Missing Capability Snapshot
Implemented:
- Managed ownership boundary + non-destructive writes
- Digest drift detection for tracked managed files
- Remove keeps consumer-modified managed files
- Post-install Webview V1 contract baseline
- Trace logger with per-operation file and severity fields

Missing or partial:
- None open from this audit scope as of 2026-03-15.

## Recommended Execution Priority
All tracked findings are resolved; continue with new-gap detection only.

## Governance Note
This audit must be kept synchronized with:
- `docs/product/decision-log.md`
- `docs/product/living-spec.md`
- `docs/product/testing-strategy.md`
- `docs/product/ci-cd-requirements.md`
