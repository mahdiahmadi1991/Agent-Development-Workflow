# Extension Behavior Summary (Consumer Guide)

## Why Read This
This extension applies Codex onboarding files into your project. Review this summary before install/update so behavior is predictable.

## What the Extension Manages
- Only extension-owned files under `.codex-onboarding/` managed paths.
- It does not modify unrelated project files.
- A static bootstrap onboarding file is always included: `.codex-onboarding/AGENTS.md`.
- Root `AGENTS.md` integration behavior:
  - if missing, install creates it automatically with onboarding pointer content.
  - if already present, install asks permission before editing.
  - if permission is denied, file remains unchanged and post-install page provides a manual snippet.

## Lifecycle Commands
- `Codex Onboarding: Install`
- `Codex Onboarding: Remove`
- `Codex Onboarding: Repair`

## Safety and Ownership
- Non-destructive by default.
- Managed updates stop if consumer modifications are detected in managed files.
- Remove runs an impact scan first.
- If no changes are detected in `.codex-onboarding/`, remove runs without confirmation.
- If managed drift or additional user files are detected in `.codex-onboarding/`, remove asks destructive confirmation and, when approved, deletes the full `.codex-onboarding/` root.
- On successful repair/remove, extension-managed pointer content is cleaned from root `AGENTS.md` when present.

## Update Behavior
- Update is never silently auto-applied.
- You are notified when updates are available.
- You can review release notes/changelog before confirming update.
- Update confirmation is gated until both release notes and changelog are reviewed.
- On extension-version update, managed files are synchronized to current version markers.

## Git Tracking Choice
During install, you can choose:
- Track managed files in Git.
- Ignore managed paths via repository-local `.git/info/exclude`.
- If you choose ignore mode, install summary and post-install page explain how ignore was applied and how to switch back to tracking mode.
- If selected root has no Git repository, this question is skipped as not applicable.

## Logging and Diagnostics
- On operation failure, the extension opens the VS Code Output channel automatically to surface diagnostics.
- Successful or user-canceled runs do not auto-open Output by default.
- Each operation creates a unique trace log file.
- Log severity levels: `debug`, `warning`, `error`.
- Primary log path is extension global storage (`operation-logs`).
- On successful install/repair, a project-local mirror log is written to `.codex-onboarding/.managed/logs/`.
- `.codex-onboarding/.gitignore` is managed by the extension to keep mirrored log files untracked by default.

## Conflict Reporting
- If installed onboarding guidance conflicts with your needs, use local overrides first.
- Follow `.codex-onboarding/ISSUE-REPORTING.md` for user-controlled escalation guidance.
- Codex can suggest and prepare issue-ready draft content when you ask.
- Any external submission remains explicit and user-controlled in your own Codex environment.
- Issue drafts should include version/profile/log references, without sensitive file-content dumps.

## After Install
- Extension shows a success summary.
- Extension opens a dedicated post-install `WebviewPanel` in VS Code.
- The page includes a fixed V1 structure:
  - Outcome Snapshot
  - Before/After Map
  - First 3 Steps
  - Prompt Packs (`Discover`, `Implement`, `Validate`)
  - Safe Boundaries
  - Lifecycle Playbook
  - Change Report
- Conditional block:
  - `Git Tracking Details` is shown only when ignore mode is selected and applied via `.git/info/exclude`.
- Primary Action Bar quick actions:
  - `Open Managed Root`
  - `Open Operation Log`
  - `Run Repair`
  - `Run Remove`
- Secondary quick actions:
  - `Copy Starter Prompt`
- Additional prompt examples: `docs/consumer/AI-Quickstart.md`

## Runtime Support
Supported and tested targets are documented in:
- `docs/product/environment-support-matrix.md`

## Privacy
- No outbound telemetry in current state.
- Diagnostics are local-first.
