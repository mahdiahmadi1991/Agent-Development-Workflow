# Documentation Drift Control

## Goal
Minimize drift between planned behavior, governance rules, and repository structure.

## Drift Risk Types
1. Semantic drift
- Behavior changes in one file but not in canonical decision records.

2. Structural drift
- Docs reference files/contracts that do not exist in repository.

3. Phase drift
- Current phase statements conflict across governance/product documents.

4. Coverage drift
- Scenario/test/CI contracts do not include newly accepted behavior.

5. Boundary drift
- Governance decisions are accidentally driven by extension artifact files.

6. Execution-gate drift
- Implementation starts from idea discussion without explicit execution approval.

## Controls
1. Canonical source ownership
- Enforce source-of-truth mapping from `docs/governance/sources-of-truth.md`.

2. Same-cycle synchronization
- Any behavior-impact change must update:
  - `docs/product/decision-log.md`
  - `docs/product/living-spec.md`
  - affected UX/spec docs

3. Validation gates
- `scripts/validate-governance.sh`
- `scripts/validate-onboarding-assets.sh`

4. Coverage parity check
- New accepted decisions must be reflected in:
  - `docs/product/scenario-matrix.md`
  - `docs/product/testing-strategy.md`
  - `docs/product/ci-cd-requirements.md`

5. Boundary enforcement
- Enforce context boundary map from `docs/governance/context-boundary-map.yaml`.
- Validate boundary controls with `scripts/validate-boundaries.sh`.

6. Execution-gate enforcement
- Treat missing explicit execution command as hard stop for implementation actions.

## Repository Rule
No implementation starts unless high-risk drift findings are resolved or explicitly accepted.
