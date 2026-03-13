# Managed State Contract

## Purpose
Define a deterministic contract for extension-owned file tracking, update safety, and version synchronization.

## State File Location
- `codex-onboarding/.managed/state.json`
- This file is generated in consumer projects at runtime and is not a repository-managed source artifact.

## Authoritative Fields
- `bundle_id`
- `bundle_version`
- `extension_version`
- `applied_at_utc`
- `managed_files[]`

Each `managed_files[]` item:
- `file_id` (stable logical identifier)
- `relative_path`
- `content_digest_sha256`
- `sync_marker` (version sync stamp)
- `metadata_mode` (`embedded` | `sidecar`)
- `metadata_format` (`comment_block` | `none`)

## Synchronization Rule
When extension version changes, all managed files must be synchronized to the new extension version, even if their semantic content is unchanged.

## Metadata Strategy
Primary source of truth:
- `state.json`

Additional file-level metadata:
- Preferred for text files: embedded `comment block` metadata header.
- Fallback for unsupported formats: sidecar metadata entry in state.

## Integrity Checks
Before update:
1. Load `state.json`.
2. Recompute digest of each managed file.
3. Compare with recorded digest.
4. If drift detected in any managed file, stop operation.

During update:
1. Resolve target bundle file set.
2. Re-render metadata markers for target extension version.
3. Apply updates only to managed files.
4. Rewrite `state.json`.

## Ownership Boundary
Files not listed in `managed_files[]` are out of scope and must not be modified.
