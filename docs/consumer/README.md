# Extension Behavior Summary (Consumer Guide)

## Why Read This
This extension applies Codex onboarding files into your project. Review this summary before install/update so behavior is predictable.

## What the Extension Manages
- Only extension-owned files under `codex-onboarding/` managed paths.
- It does not modify unrelated project files.
- A static bootstrap onboarding file is always included: `codex-onboarding/core/AGENT-ONBOARDING.md`.

## Lifecycle Commands
- `Install Onboarding`
- `Remove Onboarding`
- `Repair Onboarding`

## Safety and Ownership
- Non-destructive by default.
- Managed updates stop if consumer modifications are detected in managed files.
- Remove operation deletes only unchanged managed files.
- Consumer-modified managed files are not removed or edited.

## Update Behavior
- Update is never silently auto-applied.
- You are notified when updates are available.
- You can review release notes/changelog before confirming update.
- On extension-version update, managed files are synchronized to current version markers.

## Git Tracking Choice
During install, you can choose:
- Track managed files in Git.
- Add managed paths to `.gitignore`.

## Logging and Diagnostics
- Each operation creates a unique trace log file.
- Log severity levels: `debug`, `warning`, `error`.

## Conflict Reporting
- If installed onboarding guidance conflicts with your needs, use local overrides first.
- You can optionally create an upstream issue report.
- Upstream issue creation is always user-controlled (no silent automatic submission).
- If GitHub permissions are available and you confirm, Codex can submit the issue directly for you.
- If direct submission is unavailable, use the prepared draft for manual submit.
- Issue drafts should include version/profile/log references, without sensitive file-content dumps.

## After Install
- Extension shows a success summary.
- Extension opens a dedicated guidance page in VS Code.
- Additional prompt examples: `docs/consumer/AI-Quickstart.md`

## Runtime Support
Supported and tested targets are documented in:
- `docs/product/environment-support-matrix.md`

## Privacy
- No outbound telemetry in current state.
- Diagnostics are local-first.
