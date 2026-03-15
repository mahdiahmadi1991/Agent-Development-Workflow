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
  - Scan `.codex-onboarding/` for managed drift and additional user files.
  - If no changes are detected, remove runs directly without confirmation.
  - If changes are detected, show destructive `QuickPick` confirmation.
  - If user confirms, delete full `.codex-onboarding/` root.
  - Clear managed state.
  - Report `removed`.

### S-10 Repair Managed Onboarding
- Preconditions: Managed state exists from a prior install.
- Expected:
- Validate ownership boundary.
- Use existing managed state bundle/version as restore source.
- If tracked managed files are unchanged, run without extra confirmation.
- If tracked managed files are modified/missing, show destructive-reset `QuickPick` confirmation before overwrite.
- Restore managed consistency.
  - Report `repaired` with changed file summary.

### S-10b Repair Without Prior Install Evidence
- Preconditions: No managed onboarding evidence exists in selected workspace root.
- Expected:
  - Block repair before operation proceeds.
  - Show actionable message to run install first.
  - Do not modify files.

### S-10c Repair With Missing/Corrupt State But Intact Managed Files
- Preconditions: Managed onboarding files exist, but `state.json` is missing/corrupt/empty.
- Expected:
  - Recover repair source from managed file metadata.
  - Rebuild managed state safely via repair flow.
  - Continue lifecycle flow without profile-selection questions.

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

### S-16 Post-Install Success WebviewPanel
- Preconditions: Install operation completed successfully.
- Expected:
  - Show success notification with short operation summary.
  - Open dedicated post-install `WebviewPanel` in VS Code.
  - Render fixed V1 section contract with deterministic order.
  - Render runtime summary values in Change Report.

### S-17 Bootstrap Artifact Mandatory Inclusion
- Preconditions: Install or repair command runs successfully.
- Expected:
  - `.codex-onboarding/AGENTS.md` exists after operation.
  - Artifact is tracked in managed ownership state.

### S-18 Conflict Escalation Guidance Artifact Presence
- Preconditions: Install or repair command runs successfully.
- Expected:
  - `.codex-onboarding/ISSUE-REPORTING.md` exists after operation.
  - Artifact is tracked in managed ownership state.
  - Artifact includes explicit user-consent language for any external issue submission.

### S-19 AGENTS Index Coverage for Conflict Guidance
- Preconditions: Install or repair command runs successfully.
- Expected:
  - `.codex-onboarding/AGENTS.md` references `.codex-onboarding/ISSUE-REPORTING.md`.
  - Guidance is advisory and user-controlled.

### S-20 Dynamic Question Flow Resolution
- Preconditions: Install requires Profile Selection questions.
- Expected:
  - Load questionnaire flow from questionnaire registry and family file.
  - Do not use hardcoded Profile Selection Questions question graph.
  - Fail fast with diagnostics if required flow definition is missing.

### S-21 Post-Install V1 Blocks Presence
- Preconditions: Post-install WebviewPanel opened.
- Expected:
  - Contains `Outcome Snapshot`.
  - Contains `Before/After Map`.
  - Contains `First 3 Steps`.
  - Contains `Prompt Packs` (`Discover`, `Implement`, `Validate`).
  - Contains `Safe Boundaries`.
  - Contains `Lifecycle Playbook`.
  - Contains `Change Report`.
  - Contains `Git Tracking Details` only when ignore mode is selected and applied.

### S-22 Post-Install Action Model
- Preconditions: Post-install WebviewPanel opened.
- Expected:
  - Primary Action Bar exposes: `Open Managed Root`, `Open Operation Log`, `Run Repair`, `Run Remove`.
  - Secondary quick actions expose: `Copy Starter Prompt`.
  - All actions are explicit user-initiated actions.

### S-23 Post-Install Fallback Safety
- Preconditions: Install succeeds, Webview initialization fails.
- Expected:
  - Install still completes as success.
  - Show concise fallback message.
  - Show minimal post-install summary fallback path.

### S-24 Post-Install Information Architecture Stability
- Preconditions: Post-install WebviewPanel opened.
- Expected:
  - Action Bar remains persistent top element.
  - Main base sections keep fixed order:
    1. Outcome Snapshot
    2. Before/After Map
    3. First 3 Steps
    4. Prompt Packs
    5. Safe Boundaries
    6. Lifecycle Playbook
    7. Change Report
  - Conditional insertion:
    - `Git Tracking Details` appears between `Before/After Map` and `First 3 Steps` only when ignore mode is selected and applied.
  - Detailed content follows progressive disclosure (summary-first, details-secondary).
