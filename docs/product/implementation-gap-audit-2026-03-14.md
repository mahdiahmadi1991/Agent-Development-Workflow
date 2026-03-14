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
1. Update-consent workflow (update detection + changelog/release-note gate) is missing.
2. Issue-escalation flow is currently only an external-link action, not the approved draft/confirm/submit/fallback model.
3. Scenario/test/CI contracts are broader than current automated enforcement.

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

### F-02: Update consent policy is not implemented in runtime flows
- Severity: Critical
- Contract references:
  - `docs/product/update-consent-policy.md`
  - `docs/product/scenario-matrix.md` (S-02, S-03, S-04)
  - `docs/product/decision-log.md` (D-038)
- Implementation evidence:
  - Install/repair commands do not execute update-availability checks or changelog/release-note gating.
- Gap:
  - No explicit update gate prior to managed synchronization.
- Required action:
  - Add update detection state machine and mandatory release-note acknowledgment before apply.

### F-03: Scenario S-06 behavior mismatch (missing managed file)
- Severity: Critical
- Contract references:
  - `docs/product/scenario-matrix.md` (S-06)
- Implementation evidence:
  - `packages/vscode-extension/src/services/managedInstallService.ts` writes missing managed files as new files.
- Gap:
  - Contract says update should block when tracked managed file is missing.
- Required action:
  - Distinguish first install vs update mode and enforce fail-fast on missing tracked file in update mode.

### F-04: Repair flow does not handle corrupt state rebuild path fully
- Severity: Critical
- Contract references:
  - `docs/product/scenario-matrix.md` (S-10)
  - `docs/product/recovery-policy.md`
- Implementation evidence:
  - `readExistingState` in managed install throws on corrupt JSON; repair command has no corrupt-state recovery branch.
- Gap:
  - Repair is expected to reconstruct state safely for missing/corrupt state cases.
- Required action:
  - Add explicit corrupt-state recovery path with ownership-safe reconstruction behavior.

### F-05: Issue escalation contract is partially implemented
- Severity: Critical
- Contract references:
  - `docs/product/issue-escalation-policy.md`
  - `docs/product/decision-log.md` (D-059, D-060, D-061)
- Implementation evidence:
  - `codexOnboarding.reportIssue` only opens GitHub issue URL.
- Gap:
  - Missing draft payload, explicit submit confirmation, direct-submit mode, manual fallback mode, result-state logs.
- Required action:
  - Implement escalation service with draft generation, consent gate, permission-aware submit, and fallback UX.

### F-06: Dynamic option catalog target family is still hardcoded
- Severity: High
- Contract references:
  - `docs/product/living-spec.md` (Option model)
  - `docs/product/decision-log.md` (D-008, D-009)
- Implementation evidence:
  - `family = "dotnet-csharp"` hardcoded in install/repair commands.
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
- Update consent and release-note gate in install/repair
- Full issue-escalation contract
- Full scenario parity and CI gate parity
- Full explainability and transparency coverage in runtime UI

## Recommended Execution Priority
P0 (blockers): F-02, F-03, F-04, F-05
P1: F-06, F-07, F-08, F-09, F-10
P2: F-11, F-12, F-13, F-14

## Governance Note
This audit must be kept synchronized with:
- `docs/product/decision-log.md`
- `docs/product/living-spec.md`
- `docs/product/testing-strategy.md`
- `docs/product/ci-cd-requirements.md`
