# Managed File Protection Strategy

## Goal
Protect extension-owned onboarding files from accidental edits in consumer projects.

## Practical Constraints
Hard read-only enforcement is not universally reliable across all environments:
- OS permission models differ.
- Git operations and editor tooling may alter permissions.
- Team workflows may require intentional managed-file refresh.

## Recommended Model
Use policy-enforced integrity instead of absolute filesystem lock.

Primary protection:
1. Track managed files and digests in managed state.
2. Detect drift before update.
3. Stop update on drift.
4. Provide clear remediation paths.

Optional hardening mode:
- Extension may mark managed files read-only where supported.
- Hardening mode is `opt-in`.
- This must remain optional and reversible.
- Integrity checks remain the source of truth, not file attributes.

## Why This Model
- Cross-platform predictable behavior.
- No silent data loss.
- Compatible with strict ownership boundaries.
