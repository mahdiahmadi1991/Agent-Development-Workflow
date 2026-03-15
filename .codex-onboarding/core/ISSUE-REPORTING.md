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
- It must not interrupt normal coding flow.

## Trigger Criteria
Suggest conflict escalation only when all conditions are true:
1. A real conflict exists between managed onboarding guidance and user intent.
2. Local adaptation or override has been attempted or clearly explained as insufficient.
3. The conflict is actionable for upstream improvement (not a one-off local preference).

Do not suggest escalation for routine implementation choices.

## Required Codex Behavior
1. Explain the conflict clearly and concretely.
2. Offer local override or local adaptation first.
3. If unresolved, ask once whether the user wants to report it upstream to improve the extension.
4. If user is interested, offer two explicit paths:
   - Automatic assistance path: Codex may use `gh` with the user's own environment credentials, only after explicit confirmation.
   - Manual assistance path: Codex prepares the issue draft and guides the user to submit manually.
5. Continue with the user's main task if they decline.

## Consent and Control Rules
- No external submission without explicit user approval.
- No hidden background calls.
- User can stop at any step.
- Automatic submission requires:
  - user confirmation in the current turn,
  - valid `gh` availability and authentication in the user's environment,
  - use of user-owned credentials only.

## Noise Control Policy (Non-Intrusive)
- Suggest escalation at most once per unresolved conflict thread.
- If user ignores, declines, or redirects, do not repeat the suggestion.
- Re-suggest only if the user explicitly asks, or a materially different conflict appears.
- Keep suggestion to one short sentence and continue with the main task.

## Assistant Wording Contract
Use concise, non-pushy wording:
- "If you want, I can prepare a draft issue so this can be fixed upstream."
- "No action needed now; we can continue locally."
- "If you want, I can try creating the issue automatically using your `gh` authentication after your confirmation."
- "If you prefer, I can only prepare the final issue content and you can submit it yourself."

Avoid repetitive reminders or persuasive language.

## Execution Paths
When user accepts escalation, follow one path only:

1. `Auto via gh` (user-approved)
- Verify `gh` availability/auth first (for example, `gh auth status`).
- Show the final title/body draft to the user before submission.
- Ask explicit final confirmation.
- Submit via `gh` only after confirmation.
- Share result (issue URL or clear failure reason).

2. `Manual assisted`
- Prepare a complete issue title/body.
- Provide concise submission guidance for the repository issue page.
- Do not run any external command.

## Issue Quality Gate
Before proposing an issue draft, ensure:
- Conflict is reproducible.
- Expected vs observed behavior is clear.
- Relevant managed file paths are identified.
- Override/local path limitations are documented.
- Sensitive data is removed or redacted.

## Issue Template (Draft)
Use this template when preparing the report:

```md
## Suggested Issue Title
[Onboarding Conflict] <short topic> - <project context>

## Conflict Summary
<what conflicts with what>

## Expected Behavior
<what should happen>

## Observed Behavior
<what happened instead>

## Why Local Override Was Not Enough
<why local override/adaptation did not solve it>

## Minimal Reproduction
1. <step>
2. <step>
3. <step>

## Onboarding Context
- Managed file(s): <path>
- Bundle/Profile: <id>
- Extension version: <version>

## Safety Check
- [ ] No secrets included
- [ ] Sensitive paths redacted if needed
- [ ] Only relevant diagnostics included
```

## Privacy and Safety
- Never include secrets, tokens, credentials, or private keys.
- Redact sensitive paths or identifiers when needed.
- Keep diagnostics minimal and relevant.
