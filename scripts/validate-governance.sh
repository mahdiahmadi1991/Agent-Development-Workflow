#!/usr/bin/env bash
set -euo pipefail

required_paths=(
  "AGENTS.md"
  "docs/governance/policy-hierarchy.md"
  "docs/governance/override-model.md"
  "docs/governance/working-agreement.md"
  "codex-onboarding/core/README.md"
  "codex-onboarding/overrides/README.md"
  "codex-onboarding/contract.json"
  "codex-onboarding/schemas/contract.schema.json"
)

missing=0
for p in "${required_paths[@]}"; do
  if [[ ! -f "$p" ]]; then
    echo "Missing required file: $p"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Governance validation failed."
  exit 1
fi

echo "Governance validation passed."
