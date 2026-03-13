# Issue Escalation Policy (Consumer Conflict Reports)

## Goal
Provide a safe, user-controlled way to report onboarding artifact conflicts back to this repository.

## Problem Type
A conflict report is relevant when:
- Consumer instructions appear to contradict managed onboarding policy.
- Managed guidance seems incorrect, outdated, or harmful for the target project.
- Codex cannot satisfy user intent without violating managed constraints.

## Escalation Principle
- Reporting must be explicit and user-initiated.
- No silent or automatic external issue submission.
- No outbound telemetry side-channel.
- Submission must respect the user's currently granted Codex/GitHub permissions.

## Recommended Flow
1. Codex explains the detected conflict and references the specific managed artifact.
2. Codex proposes two paths:
- local override path (consumer-controlled customization),
- report upstream issue for template/policy correction.
3. If user agrees, system prepares a pre-filled issue draft and shows full preview.
4. Codex asks explicit confirmation for submission in the current turn.
5. If required GitHub permissions are available, Codex submits directly on behalf of the user.
6. If permissions are missing or submission fails, fallback to manual submit path with the prepared draft.

## Submission Modes
1. Direct submission (preferred when available)
- Allowed only after explicit user confirmation on the prepared draft.
- Requires valid GitHub auth and sufficient repository issue scope.
- Must return created issue URL and include it in operation diagnostics.

2. Manual fallback
- Provide ready-to-submit issue draft content.
- Provide target repository issue link/template link.
- User submits manually.

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
- Make escalation action visible in post-install guidance and error dialogs.
- Label escalation as optional and user-controlled.
- Keep escalation separate from install/remove/repair command surface.
- Show explicit state/result messages for: `draft-ready`, `submitted`, `fallback-manual`.

## Governance
Any change to escalation behavior requires synchronized updates in:
- `docs/product/living-spec.md`
- `docs/product/decision-log.md`
- `docs/consumer/README.md`
