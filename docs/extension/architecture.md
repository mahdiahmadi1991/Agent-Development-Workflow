# VS Code Extension Architecture (Baseline)

## Goal
Build a VS Code extension that installs and updates Codex onboarding structure into target projects.

## MVP Responsibilities
1. Scaffold `codex-onboarding/` structure in a selected project.
2. Install managed core files.
3. Create override path for project-specific customization.
4. Validate that core files were not edited directly.

## Proposed Components
- `installer`: writes or updates onboarding files.
- `validator`: checks core integrity and override schema compliance.
- `resolver`: computes effective policy from core + overrides.
- `diagnostics`: reports violations in editor.

## Non-Goals (initial phase)
- Multi-agent support.
- Business-domain specific templates.

## Future Integration
- Optional GitHub integration for release assets and versioned onboarding bundles.
