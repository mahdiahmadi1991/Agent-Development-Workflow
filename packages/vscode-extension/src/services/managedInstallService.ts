import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { ManagedFileState, ManagedState } from "../contracts/managedState";
import { SelectedTopic } from "../contracts/selection";
import { LogLevel, LogValue } from "./outputLogger";
import { resolveOnboardingAssetRoot } from "./onboardingAssetRootResolver";

interface ManagedInstallLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

export type ManagedApplyMode = "install" | "repair";

interface ManagedInstallInput {
  extensionPath: string;
  targetRootPath: string;
  bundleId: string;
  bundleVersion: string;
  extensionVersion: string;
  selectedTopics: SelectedTopic[];
  mode?: ManagedApplyMode;
  forceResetModifiedManagedFiles?: boolean;
}

export interface ManagedInstallResult {
  statePath: string;
  managedRootPath: string;
  appliedFiles: string[];
  skippedFiles: string[];
  recoveredTrackedFiles: string[];
  removedStaleFiles: string[];
}

interface DesiredManagedFile {
  file_id: string;
  source_path: string;
  relative_path: string;
  content: string;
  metadata_mode: "embedded" | "sidecar";
  metadata_format: "comment_block" | "none";
}

const MANAGED_ROOT_GITIGNORE_RELATIVE_PATH = ".codex-onboarding/.gitignore";
const MANAGED_ROOT_GITIGNORE_CONTENT = [
  "# Managed by Codex Onboarding extension.",
  "# Add future extension-managed ignore rules below.",
  ".managed/logs/*.jsonl",
  ""
].join("\n");

function digestSha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function renderManagedMetadata(
  sourceContent: string,
  bundleId: string,
  bundleVersion: string,
  extensionVersion: string
): string {
  return sourceContent
    .replace(/^bundle_id:\s*.*$/m, `bundle_id: ${bundleId}`)
    .replace(/^bundle_version:\s*.*$/m, `bundle_version: ${bundleVersion}`)
    .replace(/^extension_version:\s*.*$/m, `extension_version: ${extensionVersion}`);
}

function parseState(raw: string): ManagedState {
  const parsed = JSON.parse(raw) as ManagedState;

  if (!Array.isArray(parsed.managed_files)) {
    throw new Error("Managed state is invalid: managed_files must be an array.");
  }

  return parsed;
}

async function readExistingState(statePath: string): Promise<ManagedState | undefined> {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    return parseState(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function toStateMap(items: ManagedFileState[]): Map<string, ManagedFileState> {
  return new Map(items.map((item) => [item.relative_path, item]));
}

function isManagedFileContent(content: string): boolean {
  const hasManagedTrue = /managed:\s*true/m.test(content);
  const hasVersionMetadata =
    /bundle_id:\s*.+/m.test(content) &&
    /bundle_version:\s*.+/m.test(content) &&
    /extension_version:\s*.+/m.test(content);

  return hasManagedTrue && hasVersionMetadata;
}

function normalizeTopicSourcePath(topicPath: string): string {
  if (topicPath.startsWith(".codex-onboarding/library/topics/")) {
    return topicPath.replace(/^\.?codex-onboarding\/library\/topics\//, "");
  }

  if (topicPath.startsWith("library/topics/")) {
    return topicPath.replace(/^library\/topics\//, "");
  }

  if (topicPath.startsWith("topics/")) {
    return topicPath.replace(/^topics\//, "");
  }

  return topicPath;
}

function buildTopicDestinationRelativePath(topicPath: string): string {
  const normalized = normalizeTopicSourcePath(topicPath);
  return path.posix.join(".codex-onboarding", "core", "topics", normalized);
}

async function buildDesiredManagedFiles(
  assetRoot: string,
  input: ManagedInstallInput
): Promise<DesiredManagedFile[]> {
  const desired: DesiredManagedFile[] = [];

  const sourceBootstrapPath = path.join(assetRoot, "core", "AGENTS.md");
  const bootstrapRaw = await fs.readFile(sourceBootstrapPath, "utf8");
  const bootstrapContent = renderManagedMetadata(
    bootstrapRaw,
    input.bundleId,
    input.bundleVersion,
    input.extensionVersion
  );

  desired.push({
    file_id: "core-agent-onboarding",
    source_path: sourceBootstrapPath,
    relative_path: ".codex-onboarding/AGENTS.md",
    content: bootstrapContent,
    metadata_mode: "embedded",
    metadata_format: "comment_block"
  });

  const sourceIndexPath = path.join(assetRoot, "core", "INDEX.md");
  const indexRaw = await fs.readFile(sourceIndexPath, "utf8");
  const indexContent = renderManagedMetadata(
    indexRaw,
    input.bundleId,
    input.bundleVersion,
    input.extensionVersion
  );

  desired.push({
    file_id: "core-onboarding-index",
    source_path: sourceIndexPath,
    relative_path: ".codex-onboarding/INDEX.md",
    content: indexContent,
    metadata_mode: "embedded",
    metadata_format: "comment_block"
  });

  const sourceIssueReportingPath = path.join(assetRoot, "core", "ISSUE-REPORTING.md");
  const issueReportingRaw = await fs.readFile(sourceIssueReportingPath, "utf8");
  const issueReportingContent = renderManagedMetadata(
    issueReportingRaw,
    input.bundleId,
    input.bundleVersion,
    input.extensionVersion
  );

  desired.push({
    file_id: "core-issue-reporting-guidance",
    source_path: sourceIssueReportingPath,
    relative_path: ".codex-onboarding/ISSUE-REPORTING.md",
    content: issueReportingContent,
    metadata_mode: "embedded",
    metadata_format: "comment_block"
  });

  desired.push({
    file_id: "managed-root-gitignore",
    source_path: "generated://managed-root-gitignore",
    relative_path: MANAGED_ROOT_GITIGNORE_RELATIVE_PATH,
    content: MANAGED_ROOT_GITIGNORE_CONTENT,
    metadata_mode: "sidecar",
    metadata_format: "none"
  });

  for (const topic of input.selectedTopics) {
    const normalizedTopicPath = normalizeTopicSourcePath(topic.path);
    const topicSourcePath = path.join(assetRoot, "library", "topics", normalizedTopicPath);
    const topicRaw = await fs.readFile(topicSourcePath, "utf8");
    const topicContent = renderManagedMetadata(
      topicRaw,
      input.bundleId,
      input.bundleVersion,
      input.extensionVersion
    );

    desired.push({
      file_id: topic.file_id,
      source_path: topicSourcePath,
      relative_path: buildTopicDestinationRelativePath(topic.path),
      content: topicContent,
      metadata_mode: "embedded",
      metadata_format: "comment_block"
    });
  }

  return desired;
}

async function ensureParentDirectory(targetRootPath: string, relativePath: string): Promise<void> {
  const fullPath = path.join(targetRootPath, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
}

async function removeEmptyParentDirs(targetRootPath: string, relativePath: string): Promise<void> {
  const stopAt = path.join(targetRootPath, ".codex-onboarding");
  let current = path.dirname(path.join(targetRootPath, relativePath));

  while (current.startsWith(stopAt)) {
    try {
      await fs.rmdir(current);
    } catch {
      break;
    }

    if (current === stopAt) {
      break;
    }

    current = path.dirname(current);
  }
}

async function applySingleManagedFile(
  targetRootPath: string,
  desired: DesiredManagedFile,
  stateMap: Map<string, ManagedFileState>,
  logger: ManagedInstallLogger,
  appliedFiles: string[],
  skippedFiles: string[],
  recoveredTrackedFiles: string[],
  mode: ManagedApplyMode,
  forceResetModifiedManagedFiles: boolean
): Promise<void> {
  await ensureParentDirectory(targetRootPath, desired.relative_path);

  logger.log("debug", "file_checked", {
    managed_file: desired.relative_path,
    source_path: desired.source_path,
    reason: "pre_write_check"
  });

  const destinationPath = path.join(targetRootPath, desired.relative_path);
  const trackedEntry = stateMap.get(desired.relative_path);
  const desiredDigest = digestSha256(desired.content);

  let destinationExists = false;
  try {
    await fs.access(destinationPath);
    destinationExists = true;
  } catch {
    destinationExists = false;
  }

  if (!destinationExists) {
    if (trackedEntry) {
      if (mode === "repair" && forceResetModifiedManagedFiles) {
        await fs.writeFile(destinationPath, desired.content, "utf8");
        appliedFiles.push(desired.relative_path);

        logger.log("debug", "repair_action", {
          managed_file: desired.relative_path,
          reason: "managed_file_recreated_after_drift_confirmation",
          content_digest_sha256: desiredDigest
        });

        return;
      }

      logger.log("error", "drift_detected", {
        managed_file: desired.relative_path,
        reason: "managed_file_missing"
      });

      throw new Error(`Managed missing file detected for '${desired.relative_path}'.`);
    }

    await fs.writeFile(destinationPath, desired.content, "utf8");
    appliedFiles.push(desired.relative_path);

    logger.log("debug", mode === "repair" ? "repair_action" : "file_applied", {
      managed_file: desired.relative_path,
      reason: "new_managed_file",
      content_digest_sha256: desiredDigest
    });

    return;
  }

  const existingContent = await fs.readFile(destinationPath, "utf8");
  const existingDigest = digestSha256(existingContent);

  if (trackedEntry) {
    if (trackedEntry.content_digest_sha256 !== existingDigest) {
      if (mode === "repair" && forceResetModifiedManagedFiles) {
        await fs.writeFile(destinationPath, desired.content, "utf8");
        appliedFiles.push(desired.relative_path);

        logger.log("debug", "repair_action", {
          managed_file: desired.relative_path,
          reason: "managed_file_reset_after_drift_confirmation",
          content_digest_sha256: desiredDigest
        });

        return;
      }

      logger.log("error", "drift_detected", {
        managed_file: desired.relative_path,
        reason: "managed_file_modified"
      });

      throw new Error(`Managed drift detected for '${desired.relative_path}'.`);
    }

    if (existingDigest !== desiredDigest) {
      await fs.writeFile(destinationPath, desired.content, "utf8");
      appliedFiles.push(desired.relative_path);

      logger.log("debug", mode === "repair" ? "repair_action" : "file_applied", {
        managed_file: desired.relative_path,
        reason: "managed_file_synced",
        content_digest_sha256: desiredDigest
      });
    } else {
      logger.log("debug", "file_checked", {
        managed_file: desired.relative_path,
        reason: "managed_file_up_to_date"
      });
    }

    return;
  }

  if (isManagedFileContent(existingContent)) {
    if (mode === "repair" && existingDigest === desiredDigest) {
      recoveredTrackedFiles.push(desired.relative_path);
      logger.log("debug", "repair_action", {
        managed_file: desired.relative_path,
        reason: "recovered_untracked_managed_file"
      });
      return;
    }

    logger.log("error", "operation_blocked", {
      managed_file: desired.relative_path,
      reason: "managed_file_untracked"
    });

    throw new Error(
      `Managed file '${desired.relative_path}' exists but is not tracked in state. Run remove then install.`
    );
  }

  skippedFiles.push(desired.relative_path);
  logger.log("warning", "file_skipped", {
    managed_file: desired.relative_path,
    reason: "already_exists_non_destructive"
  });
}

async function preflightTrackedManagedFiles(
  targetRootPath: string,
  desiredFiles: DesiredManagedFile[],
  stateMap: Map<string, ManagedFileState>,
  logger: ManagedInstallLogger,
  mode: ManagedApplyMode,
  forceResetModifiedManagedFiles: boolean
): Promise<void> {
  for (const desired of desiredFiles) {
    const trackedEntry = stateMap.get(desired.relative_path);
    if (!trackedEntry) {
      continue;
    }

    const destinationPath = path.join(targetRootPath, desired.relative_path);

    let existingContent: string;
    try {
      existingContent = await fs.readFile(destinationPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        if (mode === "repair" && forceResetModifiedManagedFiles) {
          continue;
        }

        logger.log("error", "drift_detected", {
          managed_file: desired.relative_path,
          reason: "managed_file_missing"
        });

        throw new Error(`Managed missing file detected for '${desired.relative_path}'.`);
      }

      throw error;
    }

    const existingDigest = digestSha256(existingContent);
    if (existingDigest !== trackedEntry.content_digest_sha256) {
      if (mode === "repair" && forceResetModifiedManagedFiles) {
        continue;
      }

      logger.log("error", "drift_detected", {
        managed_file: desired.relative_path,
        reason: "managed_file_modified"
      });

      throw new Error(`Managed drift detected for '${desired.relative_path}'.`);
    }
  }
}

async function reconcileStaleManagedFiles(
  targetRootPath: string,
  desiredRelativePaths: Set<string>,
  stateMap: Map<string, ManagedFileState>,
  logger: ManagedInstallLogger,
  mode: ManagedApplyMode,
  removedStaleFiles: string[]
): Promise<void> {
  const entries = Array.from(stateMap.entries());

  for (const [relativePath, trackedEntry] of entries) {
    if (desiredRelativePaths.has(relativePath)) {
      continue;
    }

    const fullPath = path.join(targetRootPath, relativePath);

    logger.log("debug", "file_checked", {
      managed_file: relativePath,
      reason: "stale_managed_precheck"
    });

    let content: string;
    try {
      content = await fs.readFile(fullPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.log("error", "drift_detected", {
          managed_file: relativePath,
          reason: "stale_managed_missing"
        });

        throw new Error(`Stale managed file '${relativePath}' is missing.`);
      }

      throw error;
    }

    const digest = digestSha256(content);
    if (digest !== trackedEntry.content_digest_sha256) {
      logger.log("error", "drift_detected", {
        managed_file: relativePath,
        reason: "stale_managed_modified"
      });

      throw new Error(`Stale managed file '${relativePath}' was modified.`);
    }

    await fs.unlink(fullPath);
    await removeEmptyParentDirs(targetRootPath, relativePath);
    stateMap.delete(relativePath);
    removedStaleFiles.push(relativePath);

    logger.log("debug", mode === "repair" ? "repair_action" : "file_removed", {
      managed_file: relativePath,
      reason: "stale_managed_removed"
    });
  }
}

export async function applyManagedInstall(
  input: ManagedInstallInput,
  logger: ManagedInstallLogger
): Promise<ManagedInstallResult> {
  const mode = input.mode ?? "install";
  const forceResetModifiedManagedFiles = input.forceResetModifiedManagedFiles ?? false;
  const assetRoot = await resolveOnboardingAssetRoot(input.extensionPath);

  const onboardingRootPath = path.join(input.targetRootPath, ".codex-onboarding");
  const managedRootPath = path.join(onboardingRootPath, ".managed");
  const statePath = path.join(managedRootPath, "state.json");

  const existingState = await readExistingState(statePath);
  const managedFileMap = toStateMap(existingState?.managed_files ?? []);

  const appliedFiles: string[] = [];
  const skippedFiles: string[] = [];
  const recoveredTrackedFiles: string[] = [];
  const removedStaleFiles: string[] = [];

  const desiredFiles = await buildDesiredManagedFiles(assetRoot, input);
  const desiredRelativePaths = new Set(desiredFiles.map((item) => item.relative_path));

  await preflightTrackedManagedFiles(
    input.targetRootPath,
    desiredFiles,
    managedFileMap,
    logger,
    mode,
    forceResetModifiedManagedFiles
  );

  for (const file of desiredFiles) {
    await applySingleManagedFile(
      input.targetRootPath,
      file,
      managedFileMap,
      logger,
      appliedFiles,
      skippedFiles,
      recoveredTrackedFiles,
      mode,
      forceResetModifiedManagedFiles
    );

    managedFileMap.set(file.relative_path, {
      file_id: file.file_id,
      relative_path: file.relative_path,
      content_digest_sha256: digestSha256(file.content),
      sync_marker: `${input.bundleVersion}|${input.extensionVersion}`,
      metadata_mode: file.metadata_mode,
      metadata_format: file.metadata_format
    });
  }

  await reconcileStaleManagedFiles(
    input.targetRootPath,
    desiredRelativePaths,
    managedFileMap,
    logger,
    mode,
    removedStaleFiles
  );

  await fs.mkdir(managedRootPath, { recursive: true });

  const state: ManagedState = {
    bundle_id: input.bundleId,
    bundle_version: input.bundleVersion,
    extension_version: input.extensionVersion,
    applied_at_utc: new Date().toISOString(),
    managed_files: Array.from(managedFileMap.values())
  };

  await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");

  logger.log("debug", "state_rewritten", {
    managed_file_count: state.managed_files.length,
    state_path: statePath
  });

  return {
    statePath,
    managedRootPath,
    appliedFiles,
    skippedFiles,
    recoveredTrackedFiles,
    removedStaleFiles
  };
}
