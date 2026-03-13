# vscode-extension

VS Code extension package for applying managed Codex onboarding artifacts to consumer projects.

## Current Implementation Status
Step 6 is implemented:
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
- post-install guidance page opening in VS Code

## Next Steps
- implement remove/repair managed ownership logic for full managed set
- implement version-aware update transitions for changed profile/topic selections
- add tests for resolver/install state transitions and drift cases
