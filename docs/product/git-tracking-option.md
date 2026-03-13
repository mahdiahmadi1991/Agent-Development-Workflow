# Git Tracking Option Policy

## Goal
Let users decide whether extension-managed onboarding files should be ignored by Git.

## User Choice
During install flow, user can choose one mode:
1. `Track managed files` (default)
2. `Ignore managed files` (add managed paths to `.gitignore`)

## Rules
- Choice is explicit and user-controlled.
- Extension must not modify unrelated `.gitignore` entries.
- Choice can be changed later via lifecycle flow.

## Safety Notes
- Ignoring managed files can reduce noise in application repository diffs.
- Tracking managed files improves auditability and team visibility.
