#!/usr/bin/env bash
set -euo pipefail

map_file="docs/governance/context-boundary-map.yaml"

if [[ ! -f "$map_file" ]]; then
  echo "Missing boundary map: $map_file"
  exit 1
fi

missing=0

governance_sources=(
  "AGENTS.md"
  "docs/governance/working-agreement.md"
  "docs/governance/sources-of-truth.md"
  "docs/governance/drift-control.md"
  "docs/product/decision-log.md"
  "docs/product/living-spec.md"
)

artifact_roots=(
  ".codex-onboarding/library/"
  ".codex-onboarding/templates/"
  ".codex-onboarding/core/"
  ".codex-onboarding/overrides/"
)

for p in "${governance_sources[@]}"; do
  if [[ ! -f "$p" ]]; then
    echo "Missing governance source: $p"
    missing=1
  fi
  if [[ "$p" == .codex-onboarding/* ]]; then
    echo "Invalid governance source under artifact root: $p"
    missing=1
  fi
done

for p in "${artifact_roots[@]}"; do
  if [[ ! -d "$p" ]]; then
    echo "Missing artifact root: $p"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Boundary validation failed."
  exit 1
fi

echo "Boundary validation passed."
