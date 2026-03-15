# Working Agreement

This file records standing rules agreed in this project.

## Governance Model
1. Canonical product behavior decisions are recorded in `docs/product/decision-log.md`.
2. `docs/product/living-spec.md` reflects the currently active behavior model.
3. This file governs process, synchronization, and anti-drift controls.
4. Duplicating full behavioral rule lists across documents is disallowed.

## Active Rules
1. Repository scope is Codex-only and English-only for repository artifacts.
2. Assistant-user conversation language should follow the user's preferred language.
3. No commit/push without explicit user approval.
4. No implementation step without explicit user approval.
5. Idea discussion does not grant implementation permission; explicit execution command is mandatory.
6. After each implementation step, execution must stop for user review.
7. No implementation commit is allowed until the user explicitly approves that step.
8. After approval, the approved step must be committed before the next implementation step starts.
9. Current phase is extension infrastructure and behavior development; onboarding topic content authoring is deferred.
10. Non-destructive apply and strict managed-file ownership boundaries are mandatory.
11. Overrides are the only allowed customization mechanism for consumer exceptions.
12. Dynamic strictness must be applied by risk level.
13. Command surface must remain minimal (`install`, `remove`, `repair`).
14. Dynamic question model is mandatory for install flow:
- Operational questions are extension-controlled.
- Profile Selection questions are data-driven from questionnaire files.
15. Repair flow is state-driven and must not depend on Profile Selection questions.
16. Governance decisions must ignore extension artifact roots as behavior-policy sources.
17. Trace-level diagnostics and local-first privacy model are mandatory.
18. Cross-platform behavior and test coverage are mandatory (Windows, WSL, Linux, macOS).
19. Release documentation (`release notes` + `CHANGELOG.md`) is mandatory.
20. Every approved change must keep the full workspace synchronized (code, docs, tests, assets, and validation scripts where impacted); partial updates are not allowed.
21. Canonical onboarding assets live only under `.codex-onboarding/**`; `packages/vscode-extension/onboarding-assets/**` is generated mirror and must not be edited manually.
22. Mirror parity is mandatory and must pass `npm run verify:onboarding-assets-sync`.

## Source-of-Truth Map
- Product behavior: `docs/product/decision-log.md`
- Behavior summary: `docs/product/living-spec.md`
- Agent-facing constraints: `AGENTS.md`
- Ownership and de-dup policy: `docs/governance/sources-of-truth.md`
- Drift controls: `docs/governance/drift-control.md`
- Boundary map: `docs/governance/context-boundary-map.yaml`

## Update Protocol
When a new permanent rule is agreed:
1. Update canonical source first (`decision-log` for product behavior, this file for governance process).
2. Sync `docs/product/living-spec.md` to match accepted decisions.
3. Sync impacted consumer/spec docs in the same cycle.
4. Sync validator scripts and CI references in the same cycle.
5. Reject implementation start when high-risk drift findings remain unresolved.
