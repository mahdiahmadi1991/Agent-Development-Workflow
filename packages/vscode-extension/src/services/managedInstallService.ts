import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { ManagedFileState, ManagedState } from "../contracts/managedState";
import { LogLevel, LogValue } from "./outputLogger";
import { resolveOnboardingAssetRoot } from "./onboardingAssetRootResolver";

interface ManagedInstallLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

interface ManagedInstallInput {
  extensionPath: string;
  targetRootPath: string;
  bundleId: string;
  bundleVersion: string;
  extensionVersion: string;
}

export interface ManagedInstallResult {
  statePath: string;
  managedRootPath: string;
  appliedFiles: string[];
  skippedFiles: string[];
}

function digestSha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function renderBootstrapMetadata(
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

function isManagedBootstrapContent(content: string): boolean {
  const hasArtifactId = /artifact_id:\s*core-agent-onboarding/m.test(content);
  const hasManagedTrue = /managed:\s*true/m.test(content);
  return hasArtifactId && hasManagedTrue;
}

export async function applyManagedInstall(
  input: ManagedInstallInput,
  logger: ManagedInstallLogger
): Promise<ManagedInstallResult> {
  const assetRoot = await resolveOnboardingAssetRoot(input.extensionPath);
  const sourceBootstrapPath = path.join(assetRoot, "core", "AGENT-ONBOARDING.md");

  const onboardingRootPath = path.join(input.targetRootPath, "codex-onboarding");
  const managedRootPath = path.join(onboardingRootPath, ".managed");
  const coreRootPath = path.join(onboardingRootPath, "core");

  const destinationRelativePath = "codex-onboarding/core/AGENT-ONBOARDING.md";
  const destinationPath = path.join(input.targetRootPath, destinationRelativePath);
  const statePath = path.join(managedRootPath, "state.json");

  const sourceContent = await fs.readFile(sourceBootstrapPath, "utf8");
  const desiredContent = renderBootstrapMetadata(
    sourceContent,
    input.bundleId,
    input.bundleVersion,
    input.extensionVersion
  );
  const desiredDigest = digestSha256(desiredContent);
  const desiredStateEntry: ManagedFileState = {
    file_id: "core-agent-onboarding",
    relative_path: destinationRelativePath,
    content_digest_sha256: desiredDigest,
    sync_marker: `${input.bundleVersion}|${input.extensionVersion}`,
    metadata_mode: "embedded",
    metadata_format: "comment_block"
  };

  const existingState = await readExistingState(statePath);
  const managedFileMap = toStateMap(existingState?.managed_files ?? []);

  const appliedFiles: string[] = [];
  const skippedFiles: string[] = [];

  await fs.mkdir(coreRootPath, { recursive: true });

  logger.log("debug", "file_checked", {
    managed_file: destinationRelativePath,
    reason: "pre_write_check"
  });

  let destinationExists = false;
  try {
    await fs.access(destinationPath);
    destinationExists = true;
  } catch {
    destinationExists = false;
  }

  if (destinationExists) {
    const existingContent = await fs.readFile(destinationPath, "utf8");
    const existingDigest = digestSha256(existingContent);
    const trackedEntry = managedFileMap.get(destinationRelativePath);

    if (trackedEntry) {
      if (trackedEntry.content_digest_sha256 !== existingDigest) {
        logger.log("error", "drift_detected", {
          managed_file: destinationRelativePath,
          reason: "managed_file_modified"
        });

        throw new Error(`Managed drift detected for '${destinationRelativePath}'.`);
      }

      if (existingDigest !== desiredDigest) {
        await fs.writeFile(destinationPath, desiredContent, "utf8");
        appliedFiles.push(destinationRelativePath);

        logger.log("debug", "file_applied", {
          managed_file: destinationRelativePath,
          reason: "managed_file_synced",
          content_digest_sha256: desiredDigest
        });
      } else {
        logger.log("debug", "file_checked", {
          managed_file: destinationRelativePath,
          reason: "managed_file_up_to_date"
        });
      }

      managedFileMap.set(destinationRelativePath, desiredStateEntry);
    } else if (isManagedBootstrapContent(existingContent)) {
      logger.log("error", "operation_blocked", {
        managed_file: destinationRelativePath,
        reason: "managed_file_untracked"
      });

      throw new Error(
        `Managed bootstrap file exists but is not tracked in state. Run repair before install.`
      );
    } else {
      skippedFiles.push(destinationRelativePath);
      logger.log("warning", "file_skipped", {
        managed_file: destinationRelativePath,
        reason: "already_exists_non_destructive"
      });
    }
  } else {
    await fs.writeFile(destinationPath, desiredContent, "utf8");

    managedFileMap.set(destinationRelativePath, desiredStateEntry);
    appliedFiles.push(destinationRelativePath);

    logger.log("debug", "file_applied", {
      managed_file: destinationRelativePath,
      reason: "new_managed_file",
      content_digest_sha256: desiredDigest
    });
  }

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
    skippedFiles
  };
}
