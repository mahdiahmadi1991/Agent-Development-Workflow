# Update Scenario Matrix

## Purpose
Define expected behavior for installation and update scenarios.

## Scenarios

### S-01 First Install
- Preconditions: No managed state exists.
- Expected:
  - Create managed paths.
  - Apply selected managed files.
  - Write `state.json`.
  - Report `applied`.

### S-02 Extension Upgrade, Content Changed
- Preconditions: Managed state exists, no drift, target bundle differs.
- Expected:
  - Notify update availability and expose release notes/changelog.
  - Proceed only after explicit user confirmation.
  - Update managed files.
  - Rewrite metadata markers with new extension version.
  - Update `state.json`.
  - Report `applied`.

### S-03 Extension Upgrade, Content Unchanged
- Preconditions: Managed state exists, no drift, semantic content unchanged.
- Expected:
  - Notify update availability and expose release notes/changelog.
  - Proceed only after explicit user confirmation.
  - Still synchronize managed files to new extension version markers.
  - Update `state.json`.
  - Report `synchronized`.

### S-04 Already Synchronized
- Preconditions: Managed state extension version and digests already match target.
- Expected:
  - No file writes.
  - Report `already_up_to_date`.

### S-05 Drifted Managed File
- Preconditions: One or more managed files changed by consumer.
- Expected:
  - Stop update (fail-fast).
  - No writes.
  - Report `blocked_drift_detected` with affected files.

### S-06 Missing Managed File
- Preconditions: Managed file listed in state is missing.
- Expected:
  - Stop update.
  - Report `blocked_missing_managed_file`.

### S-07 Unmanaged Files in Project
- Preconditions: Project has unrelated files.
- Expected:
  - Never modify unmanaged files.
  - Continue normal managed update flow.

### S-08 Optional Read-Only Hardening Enabled
- Preconditions: Hardening mode active where OS supports it.
- Expected:
  - Keep digest/state checks authoritative.
  - Apply reversible read-only flags after successful update.

### S-09 Remove Managed Onboarding
- Preconditions: Managed state exists.
- Expected:
  - Remove only files listed as managed and unchanged.
  - Preserve unmanaged files and consumer-modified managed files.
  - Clear managed state.
  - Report `removed`.

### S-10 Repair Managed Onboarding
- Preconditions: Managed state missing/corrupt or managed set inconsistent.
- Expected:
  - Validate ownership boundary.
  - Reconstruct managed state and restore managed consistency.
  - Report `repaired` with changed file summary.

### S-11 Multi-Root Workspace
- Preconditions: Multiple roots are open in VS Code.
- Expected:
  - Prompt user to select target root.
  - Persist selection context where policy allows.
  - Apply lifecycle command only to selected root.

### S-12 No Workspace File
- Preconditions: Folder opened directly in VS Code, no `.code-workspace` file.
- Expected:
  - Use opened folder as root context.
  - Execute lifecycle command normally.

### S-13 Pre-Install Transparency Acknowledgement
- Preconditions: User triggers install/apply flow.
- Expected:
  - Present behavior-impact summary before apply.
  - Require acknowledgement before file operations.
  - Abort safely if user declines acknowledgement.

### S-14 Operation Log File Creation
- Preconditions: Any lifecycle command (`install`, `remove`, `repair`) starts.
- Expected:
  - Create one unique log file for that operation.
  - Emit structured trace events with severity levels.
  - Persist log path in operation completion summary.

### S-15 Safe Downgrade
- Preconditions: User selects downgrade target from a newer managed version.
- Expected:
  - Show downgrade context and changelog/release-note visibility.
  - Require explicit user confirmation.
  - Apply only if integrity and ownership checks pass.
  - Stop and report if safety checks fail.

### S-16 Post-Install Success Guidance Page
- Preconditions: Install operation completed successfully.
- Expected:
  - Show success notification with short operation summary.
  - Open dedicated post-install guidance page in VS Code.
  - Include quick-start AI usage tips and links to managed path and operation log.

### S-17 Bootstrap Artifact Mandatory Inclusion
- Preconditions: Install or repair command runs successfully.
- Expected:
  - `codex-onboarding/core/AGENT-ONBOARDING.md` exists after operation.
  - Artifact is tracked in managed ownership state.

### S-18 Issue Escalation Direct Submission
- Preconditions: Conflict detected, user approves escalation, GitHub permissions are available.
- Expected:
  - Show issue draft preview.
  - Ask explicit per-submit confirmation.
  - Submit issue directly.
  - Return created issue URL and log submission events.

### S-19 Issue Escalation Manual Fallback
- Preconditions: Conflict detected and direct submission is unavailable or fails.
- Expected:
  - Keep escalation user-controlled.
  - Provide prepared issue draft and repository issue link.
  - Log fallback-manual event.

### S-20 Dynamic Question Flow Resolution
- Preconditions: Install/repair requires Group B profile/topic questions.
- Expected:
  - Load questionnaire flow from questionnaire registry and family file.
  - Do not use hardcoded Group B question graph.
  - Fail fast with diagnostics if required flow definition is missing.
