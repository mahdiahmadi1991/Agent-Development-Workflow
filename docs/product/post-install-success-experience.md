# Post-Install Success Experience

## Goal
Provide immediate, clear, and actionable guidance after onboarding installation completes.

## Required Completion UX
1. Success notification in VS Code
- Show short operation summary (target profile, applied/skipped counts, log reference).

2. Dedicated post-install page opened automatically
- Open an in-editor dedicated guidance page in VS Code.
- Recommended implementation pattern: render Markdown guidance content in an editor tab for portability and low complexity.

3. User enablement guidance
- Explain what was added and why.
- Show how to ask the AI model to use installed onboarding files.
- Include quick-start prompt examples.
- Include links to managed paths and operation log.
- Explain conflict-report path and when to use override vs upstream issue escalation.
- Explain submission modes: direct submit (permission + confirmation) vs manual fallback.

## Suggested Quick Actions
- `Open managed onboarding folder`
- `Copy starter prompt`
- `Open operation log`
- `Report onboarding issue`

## Non-Surprise Constraint
The completion page must align with pre-install transparency and current behavior contracts.

## Content Source
- Primary behavior summary: `docs/consumer/README.md`
- AI interaction quick-start: `docs/consumer/AI-Quickstart.md`
