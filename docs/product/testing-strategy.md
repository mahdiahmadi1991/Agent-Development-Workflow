# Testing Strategy

## Goal
Guarantee safe, deterministic extension behavior for install, remove, repair, and update synchronization.

## Test Layers
1. Unit tests
- State parsing/validation
- Digest calculation
- Resolver selection/composition logic
- Command decision engine

2. Integration tests
- Install flow end-to-end with fixture projects
- Remove flow ownership safety checks
- Repair flow recovery behavior
- Drift detection and fail-fast outcomes
- Bootstrap artifact inclusion checks for install/repair
- Pre-install acknowledgement behavior checks
- Post-install success notification and guidance-page-open checks
- Issue escalation direct-submit and manual-fallback behavior checks
- Multi-root and no-workspace-file root resolution checks
- Dynamic Group B questionnaire loading checks (registry + family flow)
- Downgrade safety and failure-path checks

3. Scenario tests
- Full coverage of `docs/product/scenario-matrix.md`
- Explicit checks for extension-upgrade sync behavior
- Explicit checks for logging severity output (`debug`, `warning`, `error`)
- Explicit checks for unique per-operation log file creation
- Explicit checks for post-install guidance content availability
- Explicit checks for issue escalation submission/fallback event coverage
- Explicit checks for dynamic questionnaire resolution behavior

4. Cross-platform tests
- Windows, Linux, macOS CI matrix
- WSL validation lane (self-hosted or dedicated workflow)

## Quality Gates
- No release without passing unit + integration + scenario gates.
- Cross-platform regressions block release.
