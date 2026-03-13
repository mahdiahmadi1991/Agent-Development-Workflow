# Selection and Resolution Standard

## Status
Approved (locked standard)

## Goal
Select the minimal, correct onboarding file set for a consumer project from a large asset library.

## Input Sources
1. Selected profile (e.g., `.NET/C# baseline`).
2. Operational answers (extension behavior context).
3. Profile Selection questionnaire answers (dynamic file-driven).
4. Topics index metadata.
5. Selector rules.

## Resolution Pipeline
1. Resolve operation context from Operational Questions answers.
2. Load Profile Selection Questions flow definition dynamically from questionnaire registry.
3. Ask Profile Selection Questions questions and map answers to capability tags.
4. Load profile baseline includes.
5. Select candidate topics from `topics.index.yaml` by applicability and capability tags.
6. Add required dependencies (`requires`).
7. Remove conflicts (`conflicts_with`) according to selector rules.
8. Apply severity/mandatory policy filters.
9. Build deterministic final set.
10. Produce `why-selected` explainability report before apply.
11. Require user confirmation and then apply.

## Questionnaire Source Contract
- Registry: `codex-onboarding/library/questionnaires/index.yaml`
- Flow file pattern: `codex-onboarding/library/questionnaires/<family>/install-flow.yaml`
- Missing required questionnaire definition is a blocking error.

## Explainability Requirement
Before writing files, show a preview grouped by:
- Baseline topics
- Cross-cutting topics
- Target-specific topics

Each selected file must include reason tags, such as:
- `selected_by_profile`
- `selected_by_capability`
- `selected_as_dependency`

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
