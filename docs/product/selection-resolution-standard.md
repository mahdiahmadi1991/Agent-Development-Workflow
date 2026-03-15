# Selection and Resolution Standard

## Status
Approved (locked standard)

## Goal
Select the minimal, correct onboarding file set for a consumer project from a large asset library.

## Input Sources
1. Resolved profile set from wizard `profile_hints` (single or composed profile).
2. Operational answers (extension behavior context).
3. Profile Selection questionnaire answers (dynamic file-driven, tree traversal output).
4. Topics index metadata.
5. Selector rules.

## Resolution Pipeline
1. Resolve operation context from Operational Questions answers.
2. Load Profile Selection Questions flow definition dynamically from questionnaire registry.
3. Run Technology Selection Wizard traversal (`single` + `multi`, progressive branching).
4. Build normalized selection payload:
- `answers`
- `selected_paths`
- `capability_tags`
- `profile_hints`
- `topic_tags`
5. Resolve profile set from `profile_hints` and merge baseline/default capability inputs.
6. Select candidate topics from `topics.index.yaml` by applicability and capability tags.
7. Add required dependencies (`requires`).
8. Remove conflicts (`conflicts_with`) according to selector rules.
9. Apply severity/mandatory policy filters.
10. Build deterministic final set.
11. Persist explainability reason tags for each selected topic.

## Questionnaire Source Contract
- Registry: `.codex-onboarding/library/questionnaires/index.yaml`
- Flow file pattern: `.codex-onboarding/library/questionnaires/<family>/install-flow.yaml`
- Missing required questionnaire definition is a blocking error.
- Invalid tree graph or rule contract is a blocking error.

## Explainability Requirement
Each selected file must include reason tags, such as:
- `selected_by_profile`
- `selected_by_capability`
- `selected_as_dependency`
- Resolver output must be visible to the user before apply (compact summary + detailed preview path).

## Determinism Requirement
Given the same inputs, resolver must produce the exact same ordered file set.

## Safety Requirement
- Non-selected files are never copied.
- Consumer-modified managed files still block update operations.

## Required Metadata Fields (Index-Level)
Each topic index entry must include:
- `file_id`
- `path`
- `category`
- `severity`
- `required`
- `applicability`
- `tags`
- `requires`
- `conflicts_with`
