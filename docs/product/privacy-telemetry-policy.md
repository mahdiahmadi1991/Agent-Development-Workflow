# Privacy and Telemetry Policy (Planning)

## Goal
Set a clear default for diagnostics and data handling.

## Baseline Policy
- No outbound telemetry in the current state.
- Operational logs are local-first diagnostics.
- Upstream issue escalation is user-initiated and consent-gated; direct submission via user permissions is allowed.
- Any future telemetry change requires explicit governance approval and must be opt-in.

## If Telemetry Is Introduced Later
- Must be disabled by default.
- Must avoid file content collection.
- Must expose transparent data schema and retention policy.
- Must include clear user consent and revocation controls.
