# Extension Behavior Summary (Consumer Guide)

## Why Read This
This extension applies Codex onboarding files into your project. Review this summary before install/update so behavior is predictable.

## What the Extension Manages
- Only extension-owned files under `.codex-onboarding/` managed paths.
- It does not modify unrelated project files.
- A static bootstrap onboarding file is always included: `.codex-onboarding/core/AGENT-ONBOARDING.md`.

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
- Ignore managed paths via repository-local `.git/info/exclude`.
- If you choose ignore mode, install summary and post-install page explain how ignore was applied and how to switch back to tracking mode.

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
- Extension opens a dedicated post-install `WebviewPanel` in VS Code.
- The page includes a fixed V1 structure:
  - Outcome Snapshot
  - Before/After Map
  - Git Tracking Details
  - First 3 Steps
  - Prompt Packs (`Discover`, `Implement`, `Validate`)
  - Safe Boundaries
  - Lifecycle Playbook
  - Change Report
- Primary Action Bar quick actions:
  - `Open Managed Root`
  - `Open Operation Log`
  - `Run Repair`
  - `Run Remove`
- Secondary quick actions:
  - `Copy Starter Prompt`
  - `Report Onboarding Issue`
- Additional prompt examples: `docs/consumer/AI-Quickstart.md`

## Runtime Support
Supported and tested targets are documented in:
- `docs/product/environment-support-matrix.md`

## Privacy
- No outbound telemetry in current state.
- Diagnostics are local-first.
