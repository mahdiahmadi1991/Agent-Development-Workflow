# Working Agreement

This file records standing rules agreed in this project.

## Governance Model
1. Canonical product behavior decisions are recorded in `docs/product/decision-log.md`.
2. `docs/product/living-spec.md` reflects the currently active behavior model.
3. This file governs process, synchronization, and anti-drift controls.
4. Duplicating full behavioral rule lists across documents is disallowed.

## Active Rules
1. Repository scope is Codex-only and English-only.
2. No commit/push without explicit user approval.
3. No implementation step without explicit user approval.
4. Idea discussion does not grant implementation permission; explicit execution command is mandatory.
5. After each implementation step, execution must stop for user review.
6. No implementation commit is allowed until the user explicitly approves that step.
7. After approval, the approved step must be committed before the next implementation step starts.
8. Current phase is extension infrastructure and behavior development; onboarding topic content authoring is deferred.
9. Non-destructive apply and strict managed-file ownership boundaries are mandatory.
10. Overrides are the only allowed customization mechanism for consumer exceptions.
11. Dynamic strictness must be applied by risk level.
12. Command surface must remain minimal (`install`, `remove`, `repair`).
13. Dynamic question model is mandatory:
- Group A operational questions are extension-controlled.
- Group B profile/topic questions are data-driven from questionnaire files.
14. Governance decisions must ignore extension artifact roots as behavior-policy sources.
15. Trace-level diagnostics and local-first privacy model are mandatory.
16. Cross-platform behavior and test coverage are mandatory (Windows, WSL, Linux, macOS).
17. Release documentation (`release notes` + `CHANGELOG.md`) is mandatory.

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
