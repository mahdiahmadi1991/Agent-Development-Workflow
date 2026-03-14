# Testing Strategy

## Goal
Guarantee safe, deterministic extension behavior for install, remove, repair, and update synchronization.

## Test Layers
1. Unit tests
- State parsing/validation
- Digest calculation
- Resolver selection/composition logic
- Command decision engine
- Post-install view-model mapping and section contract generation

2. Integration tests
- Install flow end-to-end with fixture projects
- Remove flow ownership safety checks
- Repair flow recovery behavior
- Drift detection and fail-fast outcomes
- Bootstrap artifact inclusion checks for install/repair
- Pre-install acknowledgement behavior checks
- Post-install success notification and WebviewPanel-open checks (success-only trigger)
- Post-install V1 UX block presence checks (Outcome Snapshot, Before/After Map, First 3 Steps, Prompt Packs, Safe Boundaries, Lifecycle Playbook, Change Report)
- Conditional post-install check: `Git Tracking Details` appears only when ignore mode is selected and applied.
- Post-install Action Bar and secondary action availability checks
- Post-install fallback behavior checks when Webview initialization fails
- Issue escalation direct-submit and manual-fallback behavior checks
- Multi-root and no-workspace-file root resolution checks
- Dynamic Profile Selection Questions questionnaire loading checks (registry + family flow)
- Downgrade safety and failure-path checks

3. Scenario tests
- Full coverage of `docs/product/scenario-matrix.md`
- Explicit coverage mapping for post-install scenarios: `S-16`, `S-21`, `S-22`, `S-23`, `S-24`
- Explicit checks for extension-upgrade sync behavior
- Explicit checks for logging severity output (`debug`, `warning`, `error`)
- Explicit checks for unique per-operation log file creation
- Explicit checks for post-install Webview fixed section order and runtime summary rendering
- Explicit checks for Prompt Packs content availability (`Discover`, `Implement`, `Validate`)
- Explicit checks for Action Bar command-link behavior (`Open Managed Root`, `Open Operation Log`, `Run Repair`, `Run Remove`)
- Explicit checks for progressive disclosure behavior (summary-first, details-secondary)
- Explicit checks for post-install fallback behavior when Webview initialization fails
- Explicit checks for issue escalation submission/fallback event coverage
- Explicit checks for dynamic questionnaire resolution behavior

4. Cross-platform tests
- Windows, Linux, macOS CI matrix
- WSL validation lane (self-hosted or dedicated workflow)

## Quality Gates
- No release without passing unit + integration + scenario gates.
- Cross-platform regressions block release.
