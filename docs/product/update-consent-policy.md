# Update Consent Policy

## Goal
Prevent surprise updates and preserve user control.

## Policy
- Extension must notify when a newer managed bundle/version is available.
- Update apply is explicit user action.
- Release notes/changelog must be visible before user confirms update.
- No silent auto-update of managed files.
- Backward compatibility is required for managed update behavior.

## Safety Constraints
- All integrity checks remain mandatory before update.
- User confirmation does not bypass drift protections.
