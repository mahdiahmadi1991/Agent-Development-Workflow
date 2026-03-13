# vscode-extension

VS Code extension package for applying managed Codex onboarding artifacts to consumer projects.

## Current Implementation Status
Step 1 scaffold is implemented:
- command surface registered (`Install`, `Remove`, `Repair`)
- output logger service (`debug`, `warning`, `error`)
- workspace root resolver (single-root auto-select, multi-root prompt)
- Group A operational question prompt (Git mode)
- Group B dynamic questionnaire asset loading from file system paths

## Next Steps
- implement managed install file application flow
- implement remove/repair managed ownership logic
- implement managed state handling and drift-safe update behavior
