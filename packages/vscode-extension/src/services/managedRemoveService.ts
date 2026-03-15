import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { ManagedState } from "../contracts/managedState";
import { LogLevel, LogValue } from "./outputLogger";

interface ManagedRemoveLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

export interface ManagedRemoveImpact {
  statePath: string;
  managedRootPath: string;
  hadState: boolean;
  stateCorrupt: boolean;
  modifiedManagedFiles: string[];
  missingManagedFiles: string[];
  untrackedFiles: string[];
  requiresConfirmation: boolean;
}

export interface ManagedRemoveResult {
  statePath: string;
  hadState: boolean;
  stateCleared: boolean;
  stateCorrupt: boolean;
  removedFiles: string[];
  missingManagedFiles: string[];
  skippedChangedManagedFiles: string[];
  removedManagedRoot: boolean;
  removeMode: "safe_state_cleanup" | "full_root_reset";
}

interface ManagedRemoveOptions {
  removeWholeManagedRoot?: boolean;
}

function digestSha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function parseState(raw: string): ManagedState {
  const parsed = JSON.parse(raw) as ManagedState;

  if (!Array.isArray(parsed.managed_files)) {
    throw new Error("Managed state is invalid: managed_files must be an array.");
  }

  return parsed;
}

async function tryReadState(statePath: string): Promise<{ state?: ManagedState; corrupt: boolean }> {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    return { state: parseState(raw), corrupt: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { state: undefined, corrupt: false };
    }

    return { state: undefined, corrupt: true };
  }
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join(path.posix.sep);
}

async function collectFilesRecursive(rootPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      files.push(fullPath);
    }
  }

  await walk(rootPath);
  return files;
}

function isExtensionOwnedRuntimeFile(relativePath: string): boolean {
  if (relativePath === ".codex-onboarding/.managed/state.json") {
    return true;
  }

  return relativePath.startsWith(".codex-onboarding/.managed/logs/");
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

async function tryRemoveEmptyDirectory(directoryPath: string): Promise<void> {
  try {
    await fs.rmdir(directoryPath);
  } catch {
    // Directory is either missing or not empty; both are acceptable.
  }
}

async function removeManagedRuntimeLogFiles(
  targetRootPath: string,
  managedRootPath: string,
  logger: ManagedRemoveLogger,
  removedFiles: string[]
): Promise<void> {
  const managedLogsPath = path.join(managedRootPath, ".managed", "logs");
  const logFiles = await collectFilesRecursive(managedLogsPath);

  for (const fullPath of logFiles) {
    const relativePath = normalizeRelativePath(path.relative(targetRootPath, fullPath));

    await fs.unlink(fullPath);
    removedFiles.push(relativePath);

    logger.log("debug", "file_removed", {
      managed_file: relativePath,
      reason: "managed_runtime_log_removed"
    });
  }

  await fs.rm(managedLogsPath, { recursive: true, force: true });
}

export async function analyzeManagedRemoveImpact(
  targetRootPath: string,
  logger: ManagedRemoveLogger
): Promise<ManagedRemoveImpact> {
  const managedRootPath = path.join(targetRootPath, ".codex-onboarding");
  const statePath = path.join(managedRootPath, ".managed", "state.json");
  const { state, corrupt } = await tryReadState(statePath);
  const hadState = Boolean(state) || corrupt;

  logger.log("debug", "state_loaded", {
    state_path: statePath,
    state_status: state ? "loaded" : corrupt ? "corrupt" : "missing",
    managed_file_count: state?.managed_files.length ?? 0
  });

  const modifiedManagedFiles: string[] = [];
  const missingManagedFiles: string[] = [];
  const untrackedFiles: string[] = [];

  const managedTrackedPaths = new Set<string>((state?.managed_files ?? []).map((item) => item.relative_path));

  if (state) {
    for (const item of state.managed_files) {
      const fullPath = path.join(targetRootPath, item.relative_path);

      try {
        const content = await fs.readFile(fullPath, "utf8");
        const digest = digestSha256(content);

        if (digest !== item.content_digest_sha256) {
          modifiedManagedFiles.push(item.relative_path);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          missingManagedFiles.push(item.relative_path);
          continue;
        }

        throw error;
      }
    }
  }

  const existingManagedFiles = await collectFilesRecursive(managedRootPath);
  for (const fullPath of existingManagedFiles) {
    const relativePath = normalizeRelativePath(path.relative(targetRootPath, fullPath));

    if (managedTrackedPaths.has(relativePath) || isExtensionOwnedRuntimeFile(relativePath)) {
      continue;
    }

    untrackedFiles.push(relativePath);
  }

  const requiresConfirmation =
    corrupt ||
    modifiedManagedFiles.length > 0 ||
    missingManagedFiles.length > 0 ||
    untrackedFiles.length > 0;

  logger.log("debug", "file_checked", {
    reason: "remove_impact_scan_completed",
    managed_modified_count: modifiedManagedFiles.length,
    managed_missing_count: missingManagedFiles.length,
    untracked_count: untrackedFiles.length,
    state_corrupt: corrupt,
    remove_requires_confirmation: requiresConfirmation
  });

  return {
    statePath,
    managedRootPath,
    hadState,
    stateCorrupt: corrupt,
    modifiedManagedFiles,
    missingManagedFiles,
    untrackedFiles,
    requiresConfirmation
  };
}

export async function removeManagedOnboarding(
  targetRootPath: string,
  logger: ManagedRemoveLogger,
  options: ManagedRemoveOptions = {}
): Promise<ManagedRemoveResult> {
  const managedRootPath = path.join(targetRootPath, ".codex-onboarding");
  const statePath = path.join(managedRootPath, ".managed", "state.json");
  const removeWholeManagedRoot = options.removeWholeManagedRoot ?? false;

  const removedFiles: string[] = [];
  const missingManagedFiles: string[] = [];
  const skippedChangedManagedFiles: string[] = [];

  const { state, corrupt } = await tryReadState(statePath);
  const hadState = Boolean(state) || corrupt;

  logger.log("debug", "state_loaded", {
    state_path: statePath,
    state_status: state ? "loaded" : corrupt ? "corrupt" : "missing",
    managed_file_count: state?.managed_files.length ?? 0
  });

  if (removeWholeManagedRoot) {
    const existingFiles = await collectFilesRecursive(managedRootPath);
    removedFiles.push(
      ...existingFiles.map((fullPath) =>
        normalizeRelativePath(path.relative(targetRootPath, fullPath))
      )
    );

    await fs.rm(managedRootPath, { recursive: true, force: true });

    logger.log("debug", "file_removed", {
      reason: "managed_root_removed",
      removed_count: removedFiles.length
    });

    logger.log("debug", "state_rewritten", {
      state_path: statePath,
      state_cleared: true
    });

    return {
      statePath,
      hadState,
      stateCleared: true,
      stateCorrupt: corrupt,
      removedFiles,
      missingManagedFiles,
      skippedChangedManagedFiles,
      removedManagedRoot: true,
      removeMode: "full_root_reset"
    };
  }

  if (state) {
    for (const item of state.managed_files) {
      const fullPath = path.join(targetRootPath, item.relative_path);

      logger.log("debug", "file_checked", {
        managed_file: item.relative_path,
        reason: "remove_precheck"
      });

      try {
        const existing = await fs.readFile(fullPath, "utf8");
        const digest = digestSha256(existing);

        if (digest !== item.content_digest_sha256) {
          skippedChangedManagedFiles.push(item.relative_path);
          logger.log("warning", "file_skipped", {
            managed_file: item.relative_path,
            reason: "consumer_modified_preserved"
          });
          continue;
        }

        await fs.unlink(fullPath);
        await removeEmptyParentDirs(targetRootPath, item.relative_path);

        removedFiles.push(item.relative_path);
        logger.log("debug", "file_removed", {
          managed_file: item.relative_path,
          reason: "managed_unchanged_removed"
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          missingManagedFiles.push(item.relative_path);
          logger.log("warning", "file_skipped", {
            managed_file: item.relative_path,
            reason: "managed_file_missing"
          });
          continue;
        }

        throw error;
      }
    }
  } else if (corrupt) {
    logger.log("warning", "operation_blocked", {
      reason: "managed_state_corrupt_remove_files_skipped"
    });
  }

  let stateCleared = false;
  try {
    await fs.unlink(statePath);
    stateCleared = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      stateCleared = true;
    } else {
      throw error;
    }
  }

  logger.log("debug", "state_rewritten", {
    state_path: statePath,
    state_cleared: stateCleared
  });

  await removeManagedRuntimeLogFiles(targetRootPath, managedRootPath, logger, removedFiles);

  await tryRemoveEmptyDirectory(path.join(targetRootPath, ".codex-onboarding", ".managed"));
  await tryRemoveEmptyDirectory(path.join(targetRootPath, ".codex-onboarding"));

  return {
    statePath,
    hadState,
    stateCleared,
    stateCorrupt: corrupt,
    removedFiles,
    missingManagedFiles,
    skippedChangedManagedFiles,
    removedManagedRoot: false,
    removeMode: "safe_state_cleanup"
  };
}
