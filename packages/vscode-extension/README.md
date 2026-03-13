# vscode-extension

VS Code extension package for applying managed Codex onboarding artifacts to consumer projects.

## Current Implementation Status
Step 5 is implemented:
- command surface registered (`Install`, `Remove`, `Repair`)
- output logger service (`debug`, `warning`, `error`)
- per-operation trace logger with unique `.jsonl` log file creation
- workspace root resolver (single-root auto-select, multi-root prompt)
- Operational question prompt (Git mode)
- Profile Selection Questions dynamic questionnaire loading + parsing from file system
- Profile Selection Questions dynamic question runner from questionnaire node graph
- pre-install behavior acknowledgement gate (`Apply` confirmation)
- non-destructive bootstrap file install to `codex-onboarding/core/AGENT-ONBOARDING.md`
- managed state generation in `codex-onboarding/.managed/state.json`
- tracked and unchanged managed bootstrap is synchronized on install; drift blocks update
- profile resolution from dynamic profile assets (`library/profiles/<family>/`)
- deterministic selection resolver from `topics.index.yaml` + `selector-rules.yaml`
- resolver-driven topic preview in pre-install acknowledgement
- post-install guidance page opening in VS Code

## Next Steps
- apply selected topic files from resolver output to managed paths
- implement remove/repair managed ownership logic
- implement drift detection and version-synchronized update behavior for full managed set
