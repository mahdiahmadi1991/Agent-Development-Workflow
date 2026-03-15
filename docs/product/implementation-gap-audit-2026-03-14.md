# Implementation Gap Audit (2026-03-14)

## Purpose
Record the current gaps between accepted product/governance contracts and the actual VS Code extension implementation.

## Audit Scope
- Product contracts under `docs/product/*`
- Governance contracts under `AGENTS.md` and `docs/governance/*`
- Current extension implementation under `packages/vscode-extension/src/*`
- Current CI/release workflows under `.github/workflows/*` and `scripts/*`

## Executive Summary
The extension foundation is stable (commands, managed state, non-destructive defaults, post-install webview, trace logs), but several high-impact contract items are still not implemented.

Most important unresolved areas:
1. Issue-escalation flow is currently only an external-link action, not the approved draft/confirm/submit/fallback model.
2. Scenario/test/CI contracts are broader than current automated enforcement.

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

### F-06: Dynamic option catalog target family is still hardcoded in install
- Severity: High
- Contract references:
  - `docs/product/living-spec.md` (Option model)
  - `docs/product/decision-log.md` (D-008, D-009)
- Implementation evidence:
  - `family = "dotnet-csharp"` hardcoded in install command.
- Gap:
  - Target-family selection model is not runtime-dynamic yet.
- Required action:
  - Introduce catalog-driven family selector before questionnaire flow.

### F-07: Questionnaire registry is not truly resolved from index
- Severity: High
- Contract references:
  - `docs/product/question-model-contract.md`
- Implementation evidence:
  - `questionnaireAssetService` checks `indexRaw.includes(family)` and uses hardcoded family file path.
- Gap:
  - Registry file is not parsed as canonical routing source.
- Required action:
  - Parse `index.yaml` and resolve actual `install_flow` path from registry contract.

### F-08: Explainability (`why-selected`) is not exposed to user before apply
- Severity: High
- Contract references:
  - `docs/product/selection-resolution-standard.md`
- Implementation evidence:
  - Only topic ID preview is shown in install confirmation.
- Gap:
  - Missing grouped explainability output with selection reasons.
- Required action:
  - Add user-visible explainability preview (baseline/cross-cutting/target-specific + reason tags).

### F-09: Pre-install transparency is only partially surfaced in UI
- Severity: High
- Contract references:
  - `docs/product/pre-install-transparency.md`
- Implementation evidence:
  - Current pre-install modal does not cover full transparency contract and does not link canonical consumer summary.
- Gap:
  - Required visibility items are incomplete at apply gate.
- Required action:
  - Add compact transparency summary view or link action to `docs/consumer/README.md` before apply.

### F-10: Operation logging required events are incomplete
- Severity: High
- Contract references:
  - `docs/product/operation-logging-spec.md`
  - `docs/product/ci-cd-requirements.md`
- Implementation evidence:
  - Core events exist, but required events such as `state_loaded` and escalation submit events are absent.
- Gap:
  - Logging contract and CI-level validation contract are not fully matched.
- Required action:
  - Expand event emission and add contract tests for required events.

### F-11: Up-to-date short-circuit behavior does not match contract
- Severity: Medium
- Contract references:
  - `docs/product/decision-log.md` (D-017)
  - `docs/product/scenario-matrix.md` (S-04)
- Implementation evidence:
  - State file is rewritten every run; no explicit `already_up_to_date` status path.
- Gap:
  - Contract expects no-write path when fully synchronized.
- Required action:
  - Add no-op detection and explicit up-to-date result code path.

### F-12: CI gates are narrower than declared CI/CD requirements
- Severity: Medium
- Contract references:
  - `docs/product/ci-cd-requirements.md`
- Implementation evidence:
  - CI pipeline runs tests/compile/package, but does not enforce all contract checks (template/schema/scenario parity/lint static checks).
- Gap:
  - Required gate list and actual automated enforcement diverge.
- Required action:
  - Expand workflows and validators to match declared gate contract.

### F-13: Scenario matrix coverage is partial
- Severity: Medium
- Contract references:
  - `docs/product/testing-strategy.md`
  - `docs/product/scenario-matrix.md`
- Implementation evidence:
  - Automated scenario tests currently cover subset (`S-01, S-05, S-09, S-10, S-11, S-15, S-17`).
- Gap:
  - Many declared scenarios are not explicitly mapped in executable tests.
- Required action:
  - Add missing scenario tests and enforce mapping in CI.

### F-14: Documentation drift in command naming and phase wording
- Severity: Low
- Contract references:
  - `docs/product/decision-log.md` (D-064, D-065)
- Implementation evidence:
  - Some docs still use old command naming (`Install Onboarding`) while extension uses `Codex Onboarding: Install`.
  - `AGENTS.md` active-phase wording and implementation reality are not fully aligned.
- Gap:
  - Source-of-truth consistency is partially degraded.
- Required action:
  - Run a controlled docs sync pass for command naming and phase status alignment.

## Completed vs Missing Capability Snapshot
Implemented:
- Managed ownership boundary + non-destructive writes
- Digest drift detection for tracked managed files
- Remove keeps consumer-modified managed files
- Post-install Webview V1 contract baseline
- Trace logger with per-operation file and severity fields

Missing or partial:
- Full advisory conflict-escalation coverage parity (docs + scenarios + consumer guidance)
- Full scenario parity and CI gate parity
- Full explainability and transparency coverage in runtime UI

## Recommended Execution Priority
P0 (blockers): F-03, F-04, F-05
P1: F-06, F-07, F-08, F-09, F-10
P2: F-11, F-12, F-13, F-14

## Governance Note
This audit must be kept synchronized with:
- `docs/product/decision-log.md`
- `docs/product/living-spec.md`
- `docs/product/testing-strategy.md`
- `docs/product/ci-cd-requirements.md`
