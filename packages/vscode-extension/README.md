# vscode-extension

VS Code extension package for applying managed Codex onboarding artifacts to consumer projects.

## Current Implementation Status
Step 9 is implemented:
- command surface registered (`Install`, `Remove`, `Repair`)
- output logger service (`debug`, `warning`, `error`)
- per-operation trace logger with unique `.jsonl` log file creation
- workspace root resolver (single-root auto-select, multi-root prompt)
- Operational question prompt (Git mode)
- Profile Selection Questions dynamic questionnaire loading + parsing from file system
- Profile Selection Questions dynamic question runner from questionnaire node graph
- pre-install behavior acknowledgement gate (`Apply` confirmation)
- profile resolution from dynamic profile assets (`library/profiles/<family>/`)
- deterministic selection resolver from `topics.index.yaml` + `selector-rules.yaml`
- resolver-driven topic preview in pre-install acknowledgement
- managed install applies bootstrap + selected topic files to managed core paths
- managed state generation in `codex-onboarding/.managed/state.json`
- tracked and unchanged managed files are synchronized on install; drift blocks update
- stale managed files from previous selection are removed only when integrity checks pass
- remove command removes only unchanged managed files, preserves modified managed files, and clears state
- repair command reconstructs managed state and restores eligible managed files via repair mode
- post-install guidance page opening in VS Code
- high-coverage automated tests for command lifecycle, activation wiring, trace logger behavior, and edge/recovery flows
- scenario-matrix smoke tests for install/update drift/remove/repair/downgrade lifecycle paths
- command-level smoke coverage for multi-root install target selection
- workspace root resolver tests for no-root, single-root, multi-root, and cancel flows
- GitHub CI workflow gates for tests, coverage thresholds, compile checks, VSIX packaging smoke, and artifact upload
- optional dedicated WSL validation lane in CI (self-hosted opt-in)
- release tag validation workflow with changelog/release-note consistency and package-version alignment checks
- manual release-publish workflow with optional marketplace publish and optional GitHub release creation
- deterministic release artifact checksum generation (`.vsix` + `.sha256`)
- marketplace-ready package manifest metadata coverage and reproducible build config (`tsconfig.build.json`)

## Next Steps
- add release-note template scaffolding from decision-linked changes
- complete branding assets (icon/logo variants) and marketplace visual readiness checks
