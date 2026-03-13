#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.2.3"
  exit 2
fi

version="$1"
version_no_prefix="${version#v}"
version_regex="${version_no_prefix//./\\.}"

changelog_path="CHANGELOG.md"
if [[ ! -f "$changelog_path" ]]; then
  echo "Missing changelog file: $changelog_path"
  exit 1
fi

if ! grep -Eq "^##[[:space:]]+\\[?v?${version_regex}\\]?([[:space:]]+-.*)?$" "$changelog_path"; then
  echo "CHANGELOG.md does not contain a version heading for ${version_no_prefix}."
  echo "Expected a heading like: ## [${version_no_prefix}]"
  exit 1
fi

release_note_candidates=(
  "docs/releases/v${version_no_prefix}.md"
  "docs/releases/${version_no_prefix}.md"
)

release_note_path=""
for candidate in "${release_note_candidates[@]}"; do
  if [[ -f "$candidate" ]]; then
    release_note_path="$candidate"
    break
  fi
done

if [[ -z "$release_note_path" ]]; then
  echo "Release notes file not found for version ${version_no_prefix}."
  echo "Expected one of:"
  printf ' - %s\n' "${release_note_candidates[@]}"
  exit 1
fi

if ! grep -Ei "^# .*${version_regex}" "$release_note_path" >/dev/null; then
  echo "Release notes heading must include version ${version_no_prefix}: $release_note_path"
  exit 1
fi

required_sections=(
  "Summary"
  "Behavior Impact"
  "Migration Guidance"
)

for section in "${required_sections[@]}"; do
  if ! grep -Eq "^##[[:space:]]+${section}$" "$release_note_path"; then
    echo "Missing required section '## ${section}' in ${release_note_path}"
    exit 1
  fi
done

echo "Release documentation validation passed for ${version_no_prefix}."
