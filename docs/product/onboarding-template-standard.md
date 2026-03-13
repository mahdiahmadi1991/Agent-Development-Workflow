# Onboarding File Template Standard

## Status
Approved (locked standard)

## Purpose
Define a fixed structural contract for onboarding assets so newly generated files remain consistent over time.

## Scope
- Topic instruction files
- Topic override files
- Bundle manifest files
- Library storage/index integration points

## Canonical Template Files
- `.codex-onboarding/templates/topic-instruction.template.md`
- `.codex-onboarding/templates/topic-override.template.md`
- `.codex-onboarding/templates/bundle-manifest.template.yaml`

## Related Standards
- `docs/product/asset-library-storage-standard.md`
- `docs/product/selection-resolution-standard.md`
- `docs/product/topics-index-contract.md`

## Required Structural Rules
1. Topic files are one-topic-per-file.
2. Topic files must start with a `comment block` metadata header.
3. Topic metadata must include identity, applicability, policy, and ownership/sync fields.
4. Topic body sections must remain in this exact order:
- Intent
- Applicability
- Mandatory Rules
- Recommended Practices
- Anti-Patterns
- AI Execution Contract
- Prompt Starters
- Validation Checklist
- Allowed Override Surface
- Change Impact Notes
5. Override files may alter only sections explicitly marked overridable by the target topic file.
6. Bundle manifest must declare bundle identity, path contract, topic/profile mapping, update policy, and logging policy.

## Enforcement
- Local validation: `scripts/validate-onboarding-assets.sh`
- Governance validation entrypoint: `scripts/validate-governance.sh`
- CI gate: `.github/workflows/validate-governance.yml`

## Change Control
Any change to this standard requires:
1. Explicit approval.
2. Decision log update.
3. Validator update in the same cycle.
