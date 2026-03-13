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
- `operation_started`
- `state_loaded`
- `target_resolved`
- `operational_question_asked`
- `dynamic_question_flow_loaded`
- `dynamic_question_asked`
- `file_checked`
- `file_applied`
- `file_skipped`
- `file_removed`
- `repair_action`
- `drift_detected`
- `operation_blocked`
- `success_notification_shown`
- `post_install_page_opened`
- `issue_escalation_suggested`
- `issue_draft_prepared`
- `issue_submit_confirm_requested`
- `issue_submit_attempted`
- `issue_submit_succeeded`
- `issue_submit_failed`
- `issue_submit_fallback_manual`
- `state_rewritten`
- `operation_completed`

## Required Fields
- `operation_id`
- `trace_id`
- `severity` (`debug` | `warning` | `error`)
- `command` (`install` | `remove` | `repair`)
- `target_profile`
- `managed_file`
- `result_code`
- `reason`

## Output Requirements
- Human-readable summary in VS Code notifications.
- Detailed trace log persisted for debugging.
- Deterministic result codes for support diagnostics.
- Log retention policy must be explicit and documented.

## Log File Policy
- One dedicated log file per lifecycle operation (`install`, `remove`, `repair`).
- Log filename must be unique and collision-safe.
- Recommended pattern: `<command>-<utc-timestamp>-<operation_id>.jsonl`
