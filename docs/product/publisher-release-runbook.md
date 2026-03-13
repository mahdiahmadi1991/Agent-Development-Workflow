# Publisher Release Runbook

## Goal
Provide a deterministic, operator-friendly release procedure for publishing the VS Code extension to Marketplace and/or GitHub Releases.

## Scope
- Repository: `Codex-Onboarding-Workflow`
- Package: `packages/vscode-extension`
- Workflows:
  - `.github/workflows/release-tag-validation.yml`
  - `.github/workflows/release-publish-vscode-extension.yml`

## Preconditions
1. Target release version exists in:
- `packages/vscode-extension/package.json` (`version`)
- `CHANGELOG.md` (`## [<version>]` heading)
- `docs/releases/v<version>.md`

2. Git tag exists:
- `v<version>`

3. Marketplace credentials are configured:
- Repository/organization secret: `VSCE_PAT`
- GitHub environment: `vscode-marketplace` (recommended protection rules enabled)

4. Branch policy:
- Release tags must point to approved `main` history.

## Release Flow
### Step 1: Validate and package (mandatory)
Trigger workflow:
- `Release Tag Validation`
- by pushing tag `v<version>` or manual dispatch with `version`

Expected outputs:
- tests + compile + packaging pass
- artifacts uploaded:
  - `codex-onboarding.vsix`
  - `codex-onboarding.vsix.sha256`

### Step 2: Optional publish actions
Trigger workflow:
- `Release Publish VSCode Extension` (manual)

Inputs:
- `version`: `x.y.z` (or `vx.y.z`)
- `publish_to_marketplace`: `true|false`
- `create_github_release`: `true|false`

Behavior:
- always re-validates release docs and package version
- always rebuilds and re-uploads release-candidate artifacts
- publishes to Marketplace only if `publish_to_marketplace=true`
- creates GitHub release only if `create_github_release=true`

## Recommended Operation Modes
1. Documentation-only dry run
- `publish_to_marketplace=false`
- `create_github_release=true`

2. Marketplace-only publish
- `publish_to_marketplace=true`
- `create_github_release=false`

3. Full release
- `publish_to_marketplace=true`
- `create_github_release=true`

## Failure Handling
1. Validation failure
- fix source files (`CHANGELOG.md`, release note, package version)
- rerun workflows

2. Marketplace publish failure
- verify `VSCE_PAT` validity and publisher ownership (`2ma`)
- rerun only publish workflow after fix

3. GitHub release failure
- verify tag exists and release body path (`docs/releases/v<version>.md`)
- rerun workflow with `create_github_release=true`

## Post-Release Verification Checklist
1. VSIX and checksum artifact are present in workflow run artifacts.
2. Marketplace page shows target version and expected metadata.
3. GitHub release exists (if enabled) with attached `.vsix` and `.sha256`.
4. `CHANGELOG.md` and `docs/releases/v<version>.md` are consistent.

## Local Operator Commands (Optional)
- Validate release docs: `scripts/validate-release-docs.sh <version>`
- Validate package version: `scripts/validate-vscode-extension-version.sh <version>`
- Generate release note scaffold: `scripts/scaffold-release-note.sh <version>`
