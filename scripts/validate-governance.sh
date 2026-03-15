#!/usr/bin/env bash
set -euo pipefail

required_paths=(
  "AGENTS.md"
  "README.md"
  "CHANGELOG.md"
  "docs/governance/policy-hierarchy.md"
  "docs/governance/override-model.md"
  "docs/governance/working-agreement.md"
  "docs/governance/sources-of-truth.md"
  "docs/governance/drift-control.md"
  "docs/governance/context-boundary-map.yaml"
  "docs/product/living-spec.md"
  "docs/product/decision-log.md"
  "docs/product/question-model-contract.md"
  ".codex-onboarding/core/README.md"
  ".codex-onboarding/core/AGENTS.md"
  ".codex-onboarding/core/ISSUE-REPORTING.md"
  ".codex-onboarding/overrides/README.md"
  ".codex-onboarding/contract.json"
  ".codex-onboarding/schemas/contract.schema.json"
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

if [[ -x "scripts/validate-boundaries.sh" ]]; then
  scripts/validate-boundaries.sh
else
  echo "Missing executable validator: scripts/validate-boundaries.sh"
  exit 1
fi

if [[ -x "scripts/validate-onboarding-assets.sh" ]]; then
  scripts/validate-onboarding-assets.sh
else
  echo "Missing executable validator: scripts/validate-onboarding-assets.sh"
  exit 1
fi

node packages/vscode-extension/scripts/sync-onboarding-assets.js --check

echo "Governance validation passed."
