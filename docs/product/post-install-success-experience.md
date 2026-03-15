# Post-Install Success Experience

## Goal
Provide immediate, clear, and actionable guidance after onboarding installation completes.

## Scope
- Define the post-install UX shown immediately after a successful `Install` operation.
- Keep the experience predictable and low-risk: static structure, deterministic content order, no surprise actions.
- Provide actionable onboarding guidance for consumer users and their Codex sessions.

## Non-Goals
- No dynamic questionnaire flow inside the post-install page.
- No outbound telemetry or background network actions.
- No direct file modification from page rendering itself.
- No command-surface expansion in Command Palette.

## Required Completion UX
1. Success notification in VS Code
- Show short operation summary (target profile, applied/skipped counts, log reference).
- If `ignore` mode is selected, explain ignore mechanism (`.git/info/exclude`) and explicit opt-out path.

2. Dedicated post-install page opened automatically
- Open a dedicated `WebviewPanel` immediately after install completes successfully.
- Page is static-by-design in layout and copy structure.
- Runtime values are limited to install summary fields (profile, counts, paths, log/state references).
- If install is cancelled or fails, page must not open.

3. User enablement guidance
- Explain what was added and why.
- Show how to ask the AI model to use installed onboarding files.
- Include quick-start prompt examples.
- Include links to managed paths and operation log.
- Explain conflict-report path and when to use override vs user-controlled upstream issue suggestion.

## Baseline UX Pack (V1)
The first implementation baseline must include these blocks.

1. Outcome Snapshot
- One high-clarity summary card at top.
- Includes target profile, target root, and operation result status.

2. Before/After Map
- Concise schematic of what changed in the project.
- Clarifies managed root creation and key managed artifacts.

3. Git Tracking Details (Conditional)
- Show selected Git mode, runtime strategy, and whether metadata was updated.
- Render only when `ignore` mode is selected and ignore metadata is applied.
- Explain how ignore was applied and how user can switch back to tracking mode.

4. First 3 Steps
- Three concrete actions users should do immediately after install.
- Written as actionable tasks, not abstract tips.

5. Prompt Packs
- `Discover`: prompts that make Codex read and summarize onboarding boundaries.
- `Implement`: prompts that make Codex apply constraints while coding.
- `Validate`: prompts that make Codex self-check output against onboarding rules.

6. Safe Boundaries
- Explicit warning that managed core files are extension-owned.
- Direct users to override paths for project-specific exceptions.

7. Lifecycle Playbook
- Explain when to use `Repair`.
- Explain when to use `Remove`.
- Include expected outcomes and safety notes for both.

8. Change Report
- Deterministic run report with references:
  - managed root path
  - managed state path
  - trace log path

9. Action Bar (Primary Quick Actions)
- `Open Managed Root`
- `Open Operation Log`
- `Run Repair`
- `Run Remove`
- `Open Managed Root` should prefer VS Code explorer reveal and fallback safely.
- `Open Operation Log` should prefer opening the active trace log in an editor tab and fallback safely.

## Information Architecture (Fixed Order)
Global persistent element:
- Action Bar (always visible at top).

Main section order (base):
1. Outcome Snapshot
2. Before/After Map
3. First 3 Steps
4. Prompt Packs
5. Safe Boundaries
6. Lifecycle Playbook
7. Change Report

Conditional insertion:
- `Git Tracking Details` appears between `Before/After Map` and `First 3 Steps` only when ignore mode is selected and applied.

This order is fixed for V1 and should stay stable unless explicitly revised.

## Secondary Quick Actions
- `Copy Starter Prompt`

## UI/UX Requirements
- Use a single clear hierarchy with lightweight cards/sections.
- Keep the page readable in dark, light, and high-contrast themes.
- Layout must remain responsive without page-level horizontal scrolling.
- Keep interaction minimal and explicit.
- Avoid clutter and avoid command-surface expansion.
- Use progressive disclosure for details: summary first, technical details second.
- Keep microcopy concise and imperative.

## Accessibility and Readability
- Respect VS Code theme tokens.
- Preserve contrast and readable font sizing in all supported themes.
- Avoid visual-only semantics; critical meaning must be text-accessible.

## Technical Implementation Contract
- Render via `vscode.window.createWebviewPanel`.
- Use local extension assets only.
- Apply strict Content Security Policy (CSP).
- Default to static markup; JavaScript interactivity is optional and must stay minimal.
- Preferred first iteration: no remote scripts, no remote styles, no remote fonts.

### Data Model For Runtime Injection
- `targetRootPath`
- `selectedProfile`
- `appliedCount`
- `skippedCount`
- `removedStaleCount`
- `gitMode`
- `gitTrackingStrategy`
- `gitTrackingUpdated`
- `managedStatePath`
- `operationLogPath`

### Command Links / Actions
Primary:
- `Open Managed Root`
- `Open Operation Log`
- `Run Repair`
- `Run Remove`

Secondary:
- `Copy Starter Prompt`

All actions must remain explicit, user-initiated actions.

## Failure and Fallback Behavior
- If Webview initialization fails, show a concise failure message.
- Fallback path must show a minimal post-install summary (notification and/or markdown fallback).
- Failure to open the page must not mark install as failed.

## Non-Surprise Constraint
The completion page must align with pre-install transparency and current behavior contracts.

## Execution Phases (Implementation Breakdown)
### Phase A: Contract Lock
- Finalize section order, baseline UX pack blocks, and runtime data contract.
- Lock acceptance criteria for successful rendering and fallback behavior.

Exit criteria:
- Section order and required fields are approved.

### Phase B: Static Webview Shell
- Build static HTML/CSS shell with theme-aware tokens.
- Build top-level layout for all fixed sections.

Exit criteria:
- Webview renders with no runtime data errors and supports theme compatibility baseline.

### Phase C: Content Blocks and Prompt Packs
- Implement Outcome Snapshot, Before/After Map, First 3 Steps, and Prompt Packs.
- Implement Safe Boundaries and Lifecycle Playbook blocks.

Exit criteria:
- All V1 content blocks render with stable order and expected copy behavior.

### Phase D: Change Report and Action Bar
- Inject runtime summary data.
- Implement action bar links for open-root, open-log, repair, and remove.
- Implement secondary quick action for starter-prompt copy.
- Ensure action semantics are explicit and safe.

Exit criteria:
- Runtime summary values are correct and action triggers are deterministic.

### Phase E: Install Integration and Fallback
- Replace current post-install markdown-open behavior with Webview open on successful install.
- Keep fallback path for Webview initialization failures.

Exit criteria:
- Panel opens exactly once on successful install.
- Panel does not open on cancelled/failed install.
- Webview failure does not fail install result.

### Phase F: Test Coverage
- Add unit tests for view-model and section contract presence.
- Add integration/smoke checks for success-only open behavior.
- Add tests for action bar triggers and fallback behavior.

Exit criteria:
- Tests for post-install panel behavior pass in CI.

### Phase G: Documentation and Traceability Sync
- Update consumer docs and extension README behavior summary.
- Update decision and living spec entries in same cycle.

Exit criteria:
- `decision-log`, `living-spec`, and this contract are synchronized.

## Content Source
- Primary behavior summary: `docs/consumer/README.md`
- AI interaction quick-start: `docs/consumer/AI-Quickstart.md`
