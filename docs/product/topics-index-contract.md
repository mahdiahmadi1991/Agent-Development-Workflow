# Topics Index Contract

## Status
Approved (locked standard)

## Canonical File
- `.codex-onboarding/library/indexes/topics.index.yaml`

## Purpose
Provide a single authoritative index for all selectable onboarding topic assets.

## Required Top-Level Keys
- `version`
- `topics`

## Topic Entry Contract
Each topic entry must include:
- `file_id`
- `path`
- `category`
- `severity`
- `required`
- `tags`
- `applicability`
- `requires`
- `conflicts_with`

## Integrity Rules
1. `file_id` must be unique across all entries.
2. `path` must point to an existing file under `.codex-onboarding/library/topics/`.
3. Every indexed topic must comply with onboarding template structure.
4. Every topic file under library topics must be present in this index.

## Validation Requirement
Validator must fail when:
- duplicate `file_id`
- missing required keys
- missing target file
- orphan topic file not indexed
