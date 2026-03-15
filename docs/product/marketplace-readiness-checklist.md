# Marketplace Readiness Checklist

## Goal
Provide a release-time checklist for Visual Studio Marketplace publication quality.

## Metadata Checklist
1. `publisher` is correct (`2ma`).
2. `displayName` and `description` are aligned with behavior contracts.
3. `icon` points to a valid 128x128 PNG file.
4. `repository`, `homepage`, and `bugs` links are valid.
5. `keywords` reflect current scope without overstating capabilities.
6. `preview` flag matches current release maturity.

## Packaging Checklist
1. `npm test` passes.
2. `npm run compile` passes.
3. `npm run package:ci` generates `.vsix` successfully.
4. VSIX includes icon, license, readme, and compiled output.
5. No test files or coverage artifacts are packaged.

## Release Documentation Checklist
1. `CHANGELOG.md` contains target version heading.
2. `docs/releases/v<version>.md` exists and passes section validation.
3. Decision references are included when applicable.
4. Release-note content is synchronized with actual behavior changes.

## Publishing Checklist
1. Tag `v<version>` exists on approved history.
2. `Release Tag Validation` workflow passed.
3. `Release Publish VSCode Extension` run used correct inputs.
4. `VSCE_PAT` is present and valid for publisher `2ma`.
5. `.vsix` and `.sha256` artifacts are attached to run/release outputs.

## Post-Publish Checklist
1. Marketplace listing shows correct icon and metadata.
2. Installed extension activates and registers all commands.
3. Install/repair/remove commands are manually smoke-verified.
4. Release notes and changelog remain consistent after publish.
