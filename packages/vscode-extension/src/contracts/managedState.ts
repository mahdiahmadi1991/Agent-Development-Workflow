export interface ManagedFileState {
  file_id: string;
  relative_path: string;
  content_digest_sha256: string;
  sync_marker: string;
  metadata_mode: "embedded" | "sidecar";
  metadata_format: "comment_block" | "none";
}

export interface ManagedState {
  bundle_id: string;
  bundle_version: string;
  extension_version: string;
  applied_at_utc: string;
  managed_files: ManagedFileState[];
}
