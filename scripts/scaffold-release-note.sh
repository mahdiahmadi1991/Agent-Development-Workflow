#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.2.3"
  exit 2
fi

version="$1"
version_no_prefix="${version#v}"
version_regex="${version_no_prefix//./[.]}"
changelog_path="CHANGELOG.md"
output_path="docs/releases/v${version_no_prefix}.md"
today="$(date +%Y-%m-%d)"

if [[ ! -f "$changelog_path" ]]; then
  echo "Missing changelog file: $changelog_path"
  exit 1
fi

if [[ -f "$output_path" ]]; then
  echo "Release note already exists: $output_path"
  echo "Refusing to overwrite existing file."
  exit 1
fi

changelog_section="$(
  awk -v version="$version_regex" '
    BEGIN { in_section=0 }
    $0 ~ "^##[[:space:]]+\\[?v?" version "\\]?([[:space:]]+-.*)?$" { in_section=1; next }
    in_section && $0 ~ "^##[[:space:]]+" { exit }
    in_section { print }
  ' "$changelog_path"
)"

if [[ -z "$changelog_section" ]]; then
  echo "Could not locate changelog section for version ${version_no_prefix}."
  echo "Expected heading like: ## [${version_no_prefix}]"
  exit 1
fi

summary_bullets="$(
  printf '%s\n' "$changelog_section" |
  awk '
    /^[[:space:]]*-[[:space:]]+/ {
      sub(/^[[:space:]]*-[[:space:]]+/, "", $0)
      print "- " $0
      count++
      if (count == 5) {
        exit
      }
    }
  '
)"

if [[ -z "$summary_bullets" ]]; then
  summary_bullets="- See CHANGELOG.md for detailed change entries."
fi

decision_lines="$(
  printf '%s\n' "$changelog_section" |
  grep -Eo 'D-[0-9]{3}' |
  sort -u || true
)"

if [[ -z "$decision_lines" ]]; then
  decision_bullets="- None explicitly linked in CHANGELOG for this version."
else
  decision_bullets="$(printf '%s\n' "$decision_lines" | sed 's/^/- /')"
fi

cat > "$output_path" <<EOF2
# Release v${version_no_prefix}

Release date: ${today}

## Summary
${summary_bullets}

## Behavior Impact
- Managed onboarding lifecycle behavior is unchanged unless noted in this release.
- Review the summary and changelog entries to assess impact on your workflow.

## Migration Guidance
- Review release notes and changelog before running install/repair after upgrade.
- If managed-file drift is reported, resolve drift or use documented repair flow first.

## Decision References
${decision_bullets}
EOF2

echo "Release note scaffold created: ${output_path}"
