# Operation Logging Spec

## Goal
Provide trace-level diagnostics for install, remove, and repair operations.

## Logging Principles
- Every operation has a unique `operation_id`.
- Every operation includes a deterministic `trace_id` for support correlation.
- Every log entry includes timestamp, phase, action, and outcome.
- Logs are structured for machine parsing (JSONL recommended).
- Logs never include sensitive file content.
- Trace-level granularity is required for lifecycle diagnostics.

## Severity Model
- `debug`: detailed flow and decision diagnostics.
- `warning`: recoverable anomalies or skipped safety-affecting actions.
- `error`: blocking failures or integrity violations.

## Required Log Events
V1 required events:
- `operation_started`
- `target_resolved`
- `operational_question_asked`
- `dynamic_question_flow_loaded`
- `dynamic_question_asked`
- `file_checked`
- `file_skipped`
- `file_removed`
- `repair_action`
- `drift_detected`
- `operation_blocked`
- `success_notification_shown`
- `post_install_page_opened`
- `state_rewritten`
- `operation_log_mirrored`
- `operation_completed`

## Required Fields
- `operation_id`
- `trace_id`
- `severity` (`debug` | `warning` | `error`)
- `command` (`install` | `remove` | `repair`)
- `result_code` (for completion events)
- `reason` (for blocked/failed events)

Conditional fields (event-specific):
- `target_profile`
- `managed_file`
- `target_root`
- `state_path`
- `project_log_path`

## Output Requirements
- Human-readable summary in VS Code notifications.
- VS Code Output channel opens automatically on operation failure to surface diagnostics immediately.
- Successful and user-canceled flows do not auto-open Output by default.
- Detailed trace log persisted for debugging.
- Deterministic result codes for support diagnostics.
- Log retention policy must be explicit and documented.

## Log File Policy
- One dedicated log file per lifecycle operation (`install`, `remove`, `repair`).
- Log filename must be unique and collision-safe.
- Recommended pattern: `<command>-<utc-timestamp>-<operation_id>.jsonl`
- Primary storage: extension global storage (`<extension-global-storage>/operation-logs/`).
- Project mirror storage: on successful `install` and `repair`, mirror primary log to `.codex-onboarding/.managed/logs/<filename>`.
- Managed onboarding root includes `.codex-onboarding/.gitignore` with extension-owned ignore rules so mirrored runtime logs stay untracked by default without modifying user root `.gitignore`.

## Retention Policy
- Primary logs in extension global storage are retained until user cleanup/uninstall.
- Project-mirrored logs are retained in project workspace and follow repository lifecycle.
- Remove command still writes primary operation logs; project log mirror is not mandatory for remove.
