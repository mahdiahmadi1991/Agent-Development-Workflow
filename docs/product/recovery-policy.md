# Rollback and Recovery Policy

## Goal
Define safe behavior when operations fail or managed-file drift is detected.

## Recovery Modes
1. `Stop and Report` (default)
- On drift or integrity mismatch, stop without writing changes.

2. `Repair Managed State`
- Reconstruct managed state when state file is missing/corrupt and managed files are intact.

3. `Reinstall Managed Set`
- Reapply full managed set for selected profile when user explicitly approves reset.

4. `Safe Downgrade`
- Apply downgrade only if managed integrity checks pass.
- Stop operation on any drift or ownership violation.

## Rollback Policy
- No destructive rollback on partial failure by default.
- Prefer transactional write strategy where feasible.
- On failure, emit exact file-level status and remediation steps.

## Recommended Remediation Paths
1. `repair` command for state or consistency issues.
2. `remove` then `install` for full managed reset.
3. explicit manual acknowledgement before any forced reinstall action.
4. `remove` reports any consumer-modified files left untouched by design.

## Safety Rule
Recovery operations must only touch extension-owned managed files.
