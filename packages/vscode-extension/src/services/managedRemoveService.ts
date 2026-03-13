import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { ManagedState } from "../contracts/managedState";
import { LogLevel, LogValue } from "./outputLogger";

interface ManagedRemoveLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

export interface ManagedRemoveResult {
  statePath: string;
  hadState: boolean;
  stateCleared: boolean;
  stateCorrupt: boolean;
  removedFiles: string[];
  preservedModifiedFiles: string[];
  missingManagedFiles: string[];
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

export async function removeManagedOnboarding(
  targetRootPath: string,
  logger: ManagedRemoveLogger
): Promise<ManagedRemoveResult> {
  const statePath = path.join(targetRootPath, ".codex-onboarding", ".managed", "state.json");

  const removedFiles: string[] = [];
  const preservedModifiedFiles: string[] = [];
  const missingManagedFiles: string[] = [];

  const { state, corrupt } = await tryReadState(statePath);
  const hadState = Boolean(state) || corrupt;

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
          preservedModifiedFiles.push(item.relative_path);
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

  return {
    statePath,
    hadState,
    stateCleared,
    stateCorrupt: corrupt,
    removedFiles,
    preservedModifiedFiles,
    missingManagedFiles
  };
}
