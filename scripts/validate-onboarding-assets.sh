#!/usr/bin/env bash
set -euo pipefail

required_paths=(
  ".codex-onboarding/templates/topic-instruction.template.md"
  ".codex-onboarding/templates/topic-override.template.md"
  ".codex-onboarding/templates/bundle-manifest.template.yaml"
  ".codex-onboarding/library/indexes/topics.index.yaml"
  ".codex-onboarding/library/rules/selector-rules.yaml"
  ".codex-onboarding/library/questionnaires/index.yaml"
)

missing=0
for p in "${required_paths[@]}"; do
  if [[ ! -f "$p" ]]; then
    echo "Missing onboarding asset file: $p"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Onboarding asset validation failed."
  exit 1
fi

echo "Onboarding asset validation passed."
