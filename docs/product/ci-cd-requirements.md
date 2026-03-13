# CI/CD Requirements

## Goal
Define non-negotiable pipeline gates before any extension release.

## Required Pipeline Gates
1. Contract validation
- Validate governance source-of-truth and drift-control files.
- Validate `managed-state-contract` structure.
- Validate instruction-asset metadata schema.
- Validate onboarding asset files against fixed template standard.
- Validate library storage layout and topics index integrity.
- Validate questionnaire registry/flow contract for dynamic Profile Selection Questions questions.

2. Scenario validation
- Execute automated checks for scenario matrix cases.
- Block release on any safety-rule regression.
- Include issue-escalation direct/fallback and bootstrap artifact scenarios.

3. Cross-platform validation
- Run test matrix on Windows, Linux, and macOS.
- Run dedicated WSL validation lane.
- Block release on environment-specific regressions.

4. Package integrity
- Deterministic package build.
- Artifact checksum generation.
- Release artifact verification before publish.

5. Quality checks
- Lint and static analysis.
- Unit/integration test pass thresholds.
- Operation-log contract validation for install/remove/repair workflows.
- Validate logging severity fields (`debug`, `warning`, `error`) in operation traces.
- Validate issue-escalation log events and questionnaire-loading log events.

6. Release hygiene
- Generate release notes from decision-linked changes.
- Attach migration notes for managed update behavior changes.
- Validate pre-install transparency summary is updated and linked.
- Validate post-install success guidance summary is updated and linked.
- Enforce changelog update for every release.
- Validate supported/tested environment documentation accuracy.

## Enforcement
- No publish step can run unless all required gates pass.
