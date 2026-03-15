# Update Consent Policy

## Goal
Prevent surprise updates and preserve user control.

## Policy
- Extension must notify when a newer managed bundle/version is available.
- Update apply is explicit user action.
- Release notes/changelog must be visible before user confirms update.
- User must review both release notes and changelog in the update gate before `Continue Update` is accepted.
- No silent auto-update of managed files.
- In current pre-release phase (no public release yet), backward-compatibility requirements are out of scope unless explicitly approved.

## Safety Constraints
- All integrity checks remain mandatory before update.
- User confirmation does not bypass drift protections.
