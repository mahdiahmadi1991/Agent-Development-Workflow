# Git Tracking Option Policy

## Goal
Let users decide whether extension-managed onboarding files should be ignored by Git.

## User Choice
During install/repair flow, if selected root is a Git repository, user can choose one mode:
1. `Track managed files` (default)
2. `Ignore managed files` (apply managed-path ignores via `.git/info/exclude`)

## Rules
- Choice is explicit and user-controlled.
- Extension must not modify user-owned project files for Git tracking behavior.
- Ignore rules are written only inside repository-local Git metadata (`.git/info/exclude`).
- Choice can be changed later via lifecycle flow.
- If selected root is not a Git repository, Git tracking question is skipped (not applicable).

## Safety Notes
- Ignoring managed files can reduce noise in application repository diffs.
- Tracking managed files improves auditability and team visibility.
