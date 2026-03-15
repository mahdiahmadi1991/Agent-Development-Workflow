#!/usr/bin/env bash
set -euo pipefail

matrix_file="docs/product/scenario-matrix.md"
coverage_file="docs/product/scenario-coverage-map.yaml"

if [[ ! -f "$matrix_file" ]]; then
  echo "Missing matrix file: $matrix_file"
  exit 1
fi

if [[ ! -f "$coverage_file" ]]; then
  echo "Missing coverage map file: $coverage_file"
  exit 1
fi

mapfile -t matrix_ids < <(
  rg -No "^### (S-[0-9]+[a-z]?)\\b" "$matrix_file" \
    | sed -E "s/^### (S-[0-9]+[a-z]?).*/\\1/" \
    | sort -u
)

mapfile -t map_ids < <(
  rg -No "^\\s*- id: (S-[0-9]+[a-z]?)\\s*$" "$coverage_file" \
    | sed -E "s/^\\s*- id: (S-[0-9]+[a-z]?)\\s*$/\\1/" \
    | sort
)

if [[ "${#matrix_ids[@]}" -eq 0 ]]; then
  echo "No scenario IDs found in $matrix_file"
  exit 1
fi

if [[ "${#map_ids[@]}" -eq 0 ]]; then
  echo "No scenario IDs found in $coverage_file"
  exit 1
fi

duplicates="$(printf '%s\n' "${map_ids[@]}" | uniq -d)"
if [[ -n "$duplicates" ]]; then
  echo "Duplicate scenario IDs in $coverage_file:"
  printf ' - %s\n' $duplicates
  exit 1
fi

missing_in_map="$(comm -23 <(printf '%s\n' "${matrix_ids[@]}" | sort) <(printf '%s\n' "${map_ids[@]}" | sort))"
if [[ -n "$missing_in_map" ]]; then
  echo "Scenario IDs missing in coverage map:"
  printf ' - %s\n' $missing_in_map
  exit 1
fi

extra_in_map="$(comm -13 <(printf '%s\n' "${matrix_ids[@]}" | sort) <(printf '%s\n' "${map_ids[@]}" | sort))"
if [[ -n "$extra_in_map" ]]; then
  echo "Coverage map contains unknown scenario IDs:"
  printf ' - %s\n' $extra_in_map
  exit 1
fi

invalid_coverage_lines="$(rg -No "^\\s+coverage:\\s*(.+)$" "$coverage_file" | sed -E "s/^\\s+coverage:\\s*//" | rg -v "^(automated|manual|deferred)$" || true)"
if [[ -n "$invalid_coverage_lines" ]]; then
  echo "Coverage map contains invalid coverage values (allowed: automated|manual|deferred):"
  printf '%s\n' "$invalid_coverage_lines"
  exit 1
fi

while IFS= read -r line; do
  ref="${line#*- }"
  ref_path="${ref%%::*}"
  if [[ ! -f "$ref_path" ]]; then
    echo "Coverage map reference path does not exist: $ref_path"
    exit 1
  fi
done < <(rg -No "^\\s+- .+::.+$" "$coverage_file")

echo "Scenario coverage validation passed."
