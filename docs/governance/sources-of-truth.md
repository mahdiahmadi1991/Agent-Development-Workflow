# Governance Sources of Truth

## Goal
Reduce policy duplication and keep one canonical location per decision type.

## Canonical Ownership Map
1. Product behavior decisions
- Canonical file: `docs/product/decision-log.md`
- Living behavior summary: `docs/product/living-spec.md`

2. Governance operating protocol
- Canonical file: `docs/governance/working-agreement.md`

3. Agent operating constraints for this repository
- Canonical file: `AGENTS.md`

4. Execution sequence and implementation phasing
- Canonical file: `docs/product/implementation-roadmap.md`

5. Context boundary between governance and extension artifacts
- Canonical file: `docs/governance/context-boundary-map.yaml`

## Execution Gate Rule
- Idea discussion must never be treated as implementation approval.
- Implementation starts only after explicit user execution command.

## De-duplication Rule
- Do not replicate full behavioral rule lists across multiple files.
- Keep summary statements in secondary files and link back to the canonical source.
- When conflicts appear, canonical source wins.

## Change Protocol
When a permanent rule changes:
1. Update the canonical file first.
2. Update summaries/references in dependent files.
3. Run governance validation scripts.
