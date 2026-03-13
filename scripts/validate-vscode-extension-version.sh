#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.2.3"
  exit 2
fi

version="$1"
version_no_prefix="${version#v}"
package_json="packages/vscode-extension/package.json"

if [[ ! -f "$package_json" ]]; then
  echo "Missing package file: $package_json"
  exit 1
fi

package_version="$(node -e "console.log(require('./${package_json}').version)")"

if [[ "$package_version" != "$version_no_prefix" ]]; then
  echo "Version mismatch."
  echo "Tag/expected version: ${version_no_prefix}"
  echo "Package version: ${package_version}"
  exit 1
fi

echo "VS Code extension version validation passed for ${version_no_prefix}."
