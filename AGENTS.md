# AGENTS.md

## Project Identity
- Project type: Codex onboarding architecture and governance repository.
- Scope: Codex-only. This repository does not target other AI agents.
- Language policy: English-only for all governance and onboarding artifacts.
- Conversation policy: Assistant replies to the user should follow the user's preferred language; this does not change artifact language rules.

## Mission
Create reusable, domain-agnostic onboarding structures that can be applied to any software project to guide Codex behavior safely and consistently.

## Active Phase
- Current phase is extension infrastructure and behavior implementation planning.
- Content authoring of onboarding topics is deferred to a separate phase/thread.

## Non-Negotiable Workflow Rules
1. No commit/push without explicit user approval.
2. No implementation step starts without explicit user approval.
3. Idea discussion does not imply implementation permission; wait for explicit execution command.
4. After each implementation step, stop and wait for user review before continuing.
5. Do not commit implementation changes until user explicitly approves that step.
6. After approval, commit the approved step before starting the next implementation step.
7. Managed core files in consumer projects must not be edited directly.
8. Consumer customization must happen through override paths.
9. Apply strictness dynamically based on risk (strict for critical domains, flexible for style/workflow).
10. Consumer-project apply/update behavior must remain non-destructive by default.
11. Upstream issue escalation must stay explicit and user-controlled.
12. All behavior-impact changes must be synchronized in the same cycle.

## Policy Hierarchy
Policy precedence is deterministic. Higher level wins on conflict.

1. `core` managed policies (immutable baseline)
2. project-level overrides (allowed extension points)
3. task-local guidance (lowest priority)

Detailed hierarchy is documented in `docs/governance/policy-hierarchy.md`.

## Override Model
- Core path (managed): `.codex-onboarding/core/`
- Override path (consumer-controlled): `.codex-onboarding/overrides/`
- Resolution: override files augment or replace allowed sections without modifying core originals.

Detailed model is documented in `docs/governance/override-model.md`.

## Source of Truth
- Product behavior decisions: `docs/product/decision-log.md`
- Living behavior summary: `docs/product/living-spec.md`
- Governance process and update protocol: `docs/governance/working-agreement.md`
- De-duplication and ownership map: `docs/governance/sources-of-truth.md`
- Drift mitigation controls: `docs/governance/drift-control.md`
- Context boundary map: `docs/governance/context-boundary-map.yaml`

## Artifact Boundary
- Files under `.codex-onboarding/library/`, `.codex-onboarding/templates/`, `.codex-onboarding/core/`, and `.codex-onboarding/overrides/` are extension artifacts.
- These artifact roots must not be treated as governance policy sources for agent behavior decisions.
- For governance decisions, use only sources listed in `docs/governance/context-boundary-map.yaml`.

## Dynamic Question Model
- Operational Questions: extension runtime/operation questions (root selection, Git mode, safety choices).
- Profile Selection Questions: dynamic questions loaded from questionnaire definition files.
- Profile Selection Questions must be driven by data from `.codex-onboarding/library/questionnaires/` and not hardcoded in extension logic.

## Change Management
- Use ADR-style documentation for architecture decisions.
- Keep governance changes small and reviewable.
- Update canonical source first, then dependent summary docs.
- Keep `docs/product/living-spec.md` and `docs/product/decision-log.md` synchronized after each decision change.
- Keep consumer-facing docs synchronized with behavior-impact changes.
- Keep validator scripts synchronized with contract/layout/template changes.
