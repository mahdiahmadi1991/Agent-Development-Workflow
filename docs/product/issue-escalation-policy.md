# Issue Escalation Policy (Consumer Conflict Reports)

## Goal
Provide a safe, user-controlled guidance model for reporting onboarding conflicts back to this repository.

## Problem Type
A conflict report is relevant when:
- Consumer instructions appear to contradict managed onboarding policy.
- Managed guidance seems incorrect, outdated, or harmful for the target project.
- Codex cannot satisfy user intent without violating managed constraints.

## Escalation Principle
- Reporting must be explicit and user-initiated.
- No silent or automatic external issue submission.
- No outbound telemetry side-channel.
- Extension runtime does not implement direct submission workflows for this policy.

## Recommended Flow
1. Codex explains the detected conflict and references the specific managed artifact.
2. Codex proposes two paths:
- local override path (consumer-controlled customization),
- report upstream issue for template/policy correction.
3. If user agrees, Codex can prepare a structured issue draft.
4. Codex asks explicit confirmation before any external action in the current user environment.
5. If the user's Codex environment and permissions support it, Codex may assist submission under user approval.
6. Otherwise, Codex provides manual-submit guidance and a ready draft payload.

## Submission Modes
1. Advisory draft mode (default policy)
- Codex prepares issue-ready content only.
- User decides when and where to submit.

2. User-environment execution mode (optional)
- Only when user explicitly requests and grants permission in their own Codex environment.
- This repository/extension policy does not require dedicated extension command support for this mode.

## Draft Payload Contract
Issue draft should include:
- extension version
- bundle id and bundle version
- selected profile/capabilities
- operation id and log-file reference
- expected behavior vs observed behavior
- minimal reproducible steps
- optional environment fingerprint (OS/runtime/editor) when available and non-sensitive

## Data Minimization
- Never include secret values or full file contents by default.
- Redact or summarize managed file snippets.
- Prefer references (path + section) over raw content dumps.

## UX Requirements
- Keep escalation advisory visible in managed onboarding artifacts.
- Label escalation as optional and user-controlled.
- Keep escalation separate from install/remove/repair command surface.
- Use `.codex-onboarding/ISSUE-REPORTING.md` as the managed guidance source in consumer projects.

## Governance
Any change to escalation behavior requires synchronized updates in:
- `docs/product/living-spec.md`
- `docs/product/decision-log.md`
- `docs/consumer/README.md`
