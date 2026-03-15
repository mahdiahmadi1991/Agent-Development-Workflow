<!--
artifact_id: core-issue-reporting-guidance
managed: true
schema_version: 1
bundle_id: TBD
bundle_version: TBD
extension_version: TBD
-->

# Conflict Feedback and Issue Reporting Guidance

## Purpose
Define how Codex should guide the user when onboarding guidance conflicts with project expectations.

## Scope
- This guidance is advisory only.
- It does not authorize automatic issue creation.

## Required Codex Behavior
1. Detect and explain the conflict clearly.
2. Suggest local override or local adaptation first when possible.
3. If conflict persists, suggest opening an upstream issue in the onboarding repository.
4. Offer execution help explicitly:
   - "If you want, I can prepare the issue draft for you."
   - "If my environment and permissions allow it, I can submit it after your confirmation."

## Consent and Control Rules
- No external submission without explicit user approval.
- No hidden background calls.
- User can stop at any step.

## Suggested Issue Payload
- Conflict summary
- Expected behavior
- Observed behavior
- Minimal repro steps
- Installed onboarding context:
  - bundle/profile identifiers
  - extension version
  - relevant managed file paths

## Privacy and Safety
- Never include secrets, tokens, credentials, or private keys.
- Redact sensitive paths or identifiers when needed.
- Keep diagnostics minimal and relevant.
