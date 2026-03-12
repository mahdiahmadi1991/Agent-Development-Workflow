# AGENTS.md

## Project Identity
- Project type: Codex onboarding architecture and governance repository.
- Scope: Codex-only. This repository does not target other AI agents.
- Language policy: English-only for all governance and onboarding artifacts.

## Mission
Create reusable, domain-agnostic onboarding structures that can be applied to any software project to guide Codex behavior safely and consistently.

## Non-Negotiable Rules
1. Never edit managed core onboarding files in consumer projects directly.
2. Customization must happen through a dedicated override path.
3. Keep templates and policies business-neutral and portable.
4. Apply strictness dynamically based on risk:
   - Critical areas (security, compliance, data safety): strict.
   - Workflow/style areas: flexible by policy.
5. In this repository workflow: no commit or push without explicit user approval.

## Policy Hierarchy
Policy precedence is deterministic. Higher level wins on conflict.

1. `core` managed policies (immutable baseline)
2. project-level overrides (allowed extension points)
3. task-local guidance (lowest priority)

Detailed hierarchy is documented in `docs/governance/policy-hierarchy.md`.

## Override Model
- Core path (managed): `codex-onboarding/core/`
- Override path (consumer-controlled): `codex-onboarding/overrides/`
- Resolution: override files augment or replace allowed sections without modifying core originals.

Detailed model is documented in `docs/governance/override-model.md`.

## Change Management
- Use ADR-style documentation for architecture decisions.
- Keep governance changes small and reviewable.
- Record every new permanent rule in `docs/governance/working-agreement.md`.
