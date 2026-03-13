# Platform Compatibility Requirements

## Goal
Ensure extension behavior is consistent across supported environments.

## Required Runtime Environments
- VS Code on Windows
- VS Code in WSL context
- VS Code on Linux
- VS Code on macOS

## Currently Out of Scope
- Remote-SSH runtime support
- Dev Container runtime support

## Cross-Platform Constraints
- Use normalized relative paths for managed files.
- Avoid OS-specific separators in persisted state.
- Avoid permission assumptions as primary integrity control.
- Keep read-only hardening optional and reversible.
- Support operation when no `.code-workspace` file is present.
- Resolve target root from VS Code context, not from workspace-file dependency.

## Compatibility Validation
- Validate command behavior in all supported environments.
- Validate state and digest logic against line-ending differences.
- Validate remove/repair behavior symmetry across platforms.
- Validate behavior in VS Code multi-root workspaces.
- Validate single-root auto-selection and multi-root prompt behavior.

## Documentation Requirement
- User-facing docs must list:
  - Supported environments
  - Tested environments
  - Currently unsupported/out-of-scope environments
