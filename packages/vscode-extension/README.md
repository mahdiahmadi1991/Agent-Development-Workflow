# vscode-extension

VS Code extension package for applying managed Codex onboarding artifacts to consumer projects.

## Current Implementation Status
Step 2 is implemented:
- command surface registered (`Install`, `Remove`, `Repair`)
- output logger service (`debug`, `warning`, `error`)
- workspace root resolver (single-root auto-select, multi-root prompt)
- Operational question prompt (Git mode)
- Profile Selection Questions dynamic questionnaire loading + parsing from file system
- Profile Selection Questions dynamic question runner from questionnaire node graph

## Next Steps
- implement managed install file application flow
- implement remove/repair managed ownership logic
- implement managed state handling and drift-safe update behavior
