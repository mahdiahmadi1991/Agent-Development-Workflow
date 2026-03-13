# Asset Library Storage Standard

## Status
Approved (locked standard)

## Goal
Define a clean, scalable, and enforceable storage layout for onboarding assets inside this repository.

## Canonical Library Root
- `.codex-onboarding/library/`

## Canonical Layout
```text
.codex-onboarding/library/
  topics/
    cross-cutting/
    dotnet/
      csharp/
        app-types/
        architecture/
        data/
        security/
        testing/
  profiles/
    dotnet-csharp/
      baseline.yaml
      web-api-simple.yaml
  questionnaires/
    index.yaml
    dotnet-csharp/
      install-flow.yaml
  rules/
    selector-rules.yaml
  indexes/
    topics.index.yaml
```

## Structural Rules
1. Topic assets are stored only under `topics/`.
2. Shared reusable guidance goes under `topics/cross-cutting/`.
3. Technology-specific guidance goes under technology taxonomy paths (e.g., `topics/dotnet/csharp/...`).
4. Install selection questions are stored under `questionnaires/<profile-family>/`.
5. Questionnaire family discovery is defined in `questionnaires/index.yaml`.
6. Profile composition files are stored under `profiles/<profile-family>/`.
7. Selector behavior rules are centralized in `rules/selector-rules.yaml`.
8. `indexes/topics.index.yaml` is the single source of truth for selectable topic assets.

## Naming Rules
- File names use lowercase kebab-case.
- `file_id` values are globally unique.
- Folder names are semantic taxonomy, not team-specific or project-specific labels.

## Governance Requirement
- Any new onboarding asset must be indexed in `indexes/topics.index.yaml`.
- Orphan assets (topic files not indexed) are invalid.
- Layout and indexing compliance must pass validator checks.
