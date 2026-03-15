#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.0.1"
  exit 2
fi

version="$1"
version_no_prefix="${version#v}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
ext_dir="${repo_root}/packages/vscode-extension"
vsix_path="${ext_dir}/artifacts/codex-onboarding.vsix"
checksum_path="${ext_dir}/artifacts/codex-onboarding.vsix.sha256"

step() {
  echo
  echo "==> $1"
}

step "Validate release documentation (${version_no_prefix})"
"${repo_root}/scripts/validate-release-docs.sh" "${version_no_prefix}"

step "Validate extension package version (${version_no_prefix})"
"${repo_root}/scripts/validate-vscode-extension-version.sh" "${version_no_prefix}"

step "Install dependencies"
(
  cd "${ext_dir}"
  npm ci
)

step "Run tests"
(
  cd "${ext_dir}"
  npm test
)

step "Compile"
(
  cd "${ext_dir}"
  npm run compile
)

step "Package VSIX"
(
  cd "${ext_dir}"
  npm run package:ci
)

step "Generate checksum"
(
  cd "${ext_dir}"
  sha256sum "${vsix_path}" > "${checksum_path}"
)

step "Verify generated artifacts"
if [[ ! -f "${vsix_path}" ]]; then
  echo "Missing VSIX artifact: ${vsix_path}"
  exit 1
fi

if [[ ! -f "${checksum_path}" ]]; then
  echo "Missing checksum artifact: ${checksum_path}"
  exit 1
fi

(
  cd "${ext_dir}/artifacts"
  sha256sum -c "$(basename "${checksum_path}")"
)

echo
ls -lh "${vsix_path}" "${checksum_path}"
echo

echo "Local release rehearsal passed for ${version_no_prefix}."
