# vscode-extension

VS Code extension package for applying managed Codex onboarding artifacts to consumer projects.

## Current Implementation Status
Step 8 is implemented:
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
- high-coverage automated tests for command and service lifecycle behavior

## Next Steps
- add extension activation-level tests for command registration and disposal
- add targeted tests for operation trace logger file format and failure tolerance
