# Implementation Roadmap (Locked)

## Purpose
Provide an operational, decision-aligned roadmap to ensure implementation stays on the agreed path.

## Execution Contract
- No implementation starts without explicit user approval.
- Idea validation alone is insufficient; explicit user execution command is required.
- No commit/push without explicit user approval.
- After each implementation step, stop for user review.
- Do not commit implementation changes until that step is explicitly approved.
- Commit approved step before starting the next implementation step.
- Every phase ends with a decision check before moving forward.
- If a new requirement conflicts with current decisions, stop and update living docs first.

## Invariants (Must Always Hold)
1. Codex-only scope.
2. English-only artifacts.
3. Topic-based instruction assets (one file per technical topic).
4. Applicability-driven composition.
5. Non-destructive apply by default.
6. Managed-file ownership boundary is strict.
7. Update must fail-fast on managed-file drift.
8. Extension upgrade must synchronize all managed files to current extension version.
9. Update must skip writes only when bundle and extension version are already synchronized.
10. Command surface stays minimal: install, remove, repair.
11. Cross-platform support is mandatory (Windows, WSL, Linux, macOS).
12. Trace-level operation logging is mandatory.
13. Pre-install transparency summary must be maintained and acknowledged before apply.
14. Update must be user-confirmed after changelog/release-note visibility.
15. Each lifecycle run must produce a unique dedicated log file.
16. Successful install must show completion summary and open post-install WebviewPanel with quick-start usage tips.
17. Every install/repair result must include the static bootstrap onboarding artifact.
18. Conflict escalation to upstream issues must remain optional and user-controlled.
19. Question flow must use two groups: Operational Questions and dynamic Profile Selection Questions.

## Phase Plan

### Phase 0: Governance Lock
- Keep `docs/product/living-spec.md` and `docs/product/decision-log.md` synchronized.
- Apply source-of-truth ownership from `docs/governance/sources-of-truth.md`.
- Apply drift controls from `docs/governance/drift-control.md`.
- Confirm scope boundaries and open decisions.
- Confirm minimal command surface contract.

Exit criteria:
- Governance sources and drift controls are validated.
- Scope boundaries are confirmed and no blocking open ambiguity remains.
- Minimal command surface contract is confirmed.
Reference: `docs/governance/sources-of-truth.md`
Reference: `docs/governance/drift-control.md`
Reference: `docs/product/command-surface.md`

### Phase 1: Instruction Asset Contract
- Define canonical metadata schema for topic applicability.
- Define mandatory baseline topics and shared-topic model.
- Define managed-state schema for update control.
- Lock canonical onboarding file templates as fixed standard.
- Define and maintain template compliance validator.
- Lock static bootstrap onboarding file contract and AGENTS integration safety rules.

Exit criteria:
- Schema and constraints are approved in writing.
Reference: `docs/product/onboarding-template-standard.md`
Reference: `docs/product/bootstrap-onboarding-file-contract.md`

### Phase 2: File Layout Contract
- Finalize folder layout under `.codex-onboarding/`.
- Define placement rules for managed and override files.
- Define generated state/lock locations.
- Lock library storage taxonomy under `.codex-onboarding/library/`.
- Define index and profile/questionnaire/rules file contracts.

Exit criteria:
- Path contract approved.
Reference: `docs/product/asset-library-storage-standard.md`
Reference: `docs/product/topics-index-contract.md`

### Phase 3: Selection and Composition Rules
- Specify resolver rules from selected target to composed topic set.
- Specify merge/precedence of baseline, shared, and target-specific topics.
- Specify deterministic ordering and conflict handling.
- Specify questionnaire-to-capability mapping rules.
- Specify dynamic Profile Selection Questions questionnaire loading contract from questionnaire registry.
- Specify dependency and conflict resolution semantics.
- Specify explainability output (`why-selected`) before apply.

Exit criteria:
- Resolver contract approved with examples.
Reference: `docs/product/selection-resolution-standard.md`
Reference: `docs/product/question-model-contract.md`

### Phase 4: Apply and Update Safety Rules
- Specify first-install behavior.
- Specify update behavior with digest validation.
- Specify drift detection, fail-fast behavior, and report format.
- Specify extension-upgrade synchronization behavior for unchanged-content files.
- Specify up-to-date short-circuit behavior.
- Specify remove and repair lifecycle safety behavior.
- Specify rollback/remediation policy.
- Specify safe downgrade behavior under integrity constraints.

Exit criteria:
- Safety behavior approved with scenario matrix.
Reference: `docs/product/recovery-policy.md`

### Phase 5: Observability and UX Contract
- Define status output categories: applied, skipped, blocked, up-to-date.
- Define user-facing messages and remediation hints.
- Define structured trace logging contract for install/remove/repair.
- Define pre-install transparency and acknowledgement UX.
- Define post-install completion UX (success summary + dedicated WebviewPanel).
- Split post-install Webview implementation into independent execution phases (A-G) as defined in `docs/product/post-install-success-experience.md`.
- Enforce the V1 professional UX baseline blocks and fixed section order from `docs/product/post-install-success-experience.md`.
- Define issue-escalation UX for conflict reporting (explicit consent, permission-aware direct submission, manual fallback).
- Define operational vs dynamic question UX and state handling.

Exit criteria:
- Status contract approved.
Reference: `docs/product/operation-logging-spec.md`
Reference: `docs/product/pre-install-transparency.md`
Reference: `docs/product/post-install-success-experience.md`
Reference: `docs/product/issue-escalation-policy.md`
Reference: `docs/product/git-tracking-option.md`
Reference: `docs/product/update-consent-policy.md`

### Phase 6: Platform Compatibility Contract
- Define path/line-ending normalization constraints.
- Define multi-root workspace behavior.
- Define read-only hardening compatibility expectations.

Exit criteria:
- Platform contract approved with validation matrix.
Reference: `docs/product/platform-compatibility.md`
Reference: `docs/product/environment-support-matrix.md`

### Phase 7: CI/CD and Release Contract
- Define CI gates for schema and contract validation.
- Define scenario-matrix test coverage gates.
- Define package/release integrity checks.
- Define release notes and migration-note requirements.
- Define cross-platform CI matrix and WSL validation approach based on Phase 6 platform contract.
- Define mandatory changelog update checks.

Exit criteria:
- CI/CD contract approved and mapped to pipeline stages.
Reference: `docs/product/ci-cd-requirements.md`
Reference: `docs/product/testing-strategy.md`
Reference: `docs/product/release-documentation-policy.md`

### Phase 8: Branding and Store Readiness
- Define extension name and short/long description copy.
- Produce icon/logo assets and usage variants.
- Define marketplace metadata checklist.

Exit criteria:
- Branding and metadata assets approved.
Reference: `docs/product/branding-requirements.md`

### Phase 9: Implementation Start (Only After Approval)
- Implement exactly against approved contracts.
- Validate against scenario matrix and invariants.

Exit criteria:
- Implementation passes agreed acceptance checks.

## Stop Conditions
- Any ambiguity in ownership/update behavior.
- Any conflict with invariants.
- Any scope drift into unapproved implementation areas.

## Traceability Rule
Every implementation task must reference at least one accepted decision ID from `docs/product/decision-log.md`.
