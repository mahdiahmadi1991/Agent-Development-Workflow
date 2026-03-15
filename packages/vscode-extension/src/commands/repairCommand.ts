import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";

import { ManagedState } from "../contracts/managedState";
import { OperationalSelections } from "../contracts/questionnaire";
import { SelectedTopic } from "../contracts/selection";
import { applyGitTrackingMode, hasGitRepository } from "../services/gitTrackingService";
import { applyManagedInstall } from "../services/managedInstallService";
import { OperationTraceLogger } from "../services/operationTraceLogger";
import { OutputLogger } from "../services/outputLogger";
import {
  buildProjectOperationLogPath,
  mirrorOperationLogToProject
} from "../services/projectOperationLogService";
import { removeRootAgentsIntegration } from "../services/rootAgentsIntegrationService";
import { resolveTargetWorkspaceFolder } from "../services/workspaceRootResolver";

function isWorkspaceSelectionCancelled(): boolean {
  return (vscode.workspace.workspaceFolders ?? []).length > 0;
}

async function askOperationalSelectionsForRepair(): Promise<OperationalSelections | undefined> {
  const gitMode = await vscode.window.showQuickPick(
    [
      {
        label: "Track managed files (Recommended)",
        description: "Keep onboarding artifacts versioned in your repository.",
        value: "track" as const
      },
      {
        label: "Ignore managed files in local Git metadata",
        description: "Ignore managed paths via .git/info/exclude without editing project files.",
        value: "ignore" as const
      }
    ],
    {
      title: "Repair Options",
      placeHolder: "Choose how managed onboarding files should behave in Git"
    }
  );

  if (!gitMode) {
    return undefined;
  }

  return { gitMode: gitMode.value };
}

function digestSha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function parseManagedState(raw: string): ManagedState {
  const parsed = JSON.parse(raw) as ManagedState;
  if (!Array.isArray(parsed.managed_files)) {
    throw new Error("Managed state is invalid: managed_files must be an array.");
  }

  return parsed;
}

interface ManagedStateLoadResult {
  state: ManagedState | undefined;
  status: "loaded" | "missing" | "corrupt";
}

async function readManagedState(targetRootPath: string): Promise<ManagedStateLoadResult> {
  const statePath = path.join(targetRootPath, ".codex-onboarding", ".managed", "state.json");

  try {
    const raw = await fs.readFile(statePath, "utf8");
    return {
      state: parseManagedState(raw),
      status: "loaded"
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        state: undefined,
        status: "missing"
      };
    }

    return {
      state: undefined,
      status: "corrupt"
    };
  }
}

interface ManagedMetadata {
  artifactId: string;
  bundleId: string;
  bundleVersion: string;
  extensionVersion: string;
}

function parseManagedMetadata(content: string): ManagedMetadata | undefined {
  const managedMatch = content.match(/^managed:\s*(.+)$/m);
  if (!managedMatch || managedMatch[1]?.trim().toLowerCase() !== "true") {
    return undefined;
  }

  const artifactId = content.match(/^artifact_id:\s*(.+)$/m)?.[1]?.trim();
  const bundleId = content.match(/^bundle_id:\s*(.+)$/m)?.[1]?.trim();
  const bundleVersion = content.match(/^bundle_version:\s*(.+)$/m)?.[1]?.trim();
  const extensionVersion = content.match(/^extension_version:\s*(.+)$/m)?.[1]?.trim();

  if (!artifactId || !bundleId || !bundleVersion || !extensionVersion) {
    return undefined;
  }

  return {
    artifactId,
    bundleId,
    bundleVersion,
    extensionVersion
  };
}

async function collectFilePathsRecursive(rootPath: string): Promise<string[]> {
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

interface RecoveredRepairSource {
  bundleId: string;
  bundleVersion: string;
  extensionVersion: string;
  selectedTopics: SelectedTopic[];
}

async function recoverRepairSourceFromManagedFiles(
  targetRootPath: string,
  traceLogger: OperationTraceLogger
): Promise<RecoveredRepairSource | undefined> {
  const managedRootPath = path.join(targetRootPath, ".codex-onboarding");
  const bootstrapPath = path.join(managedRootPath, "AGENTS.md");

  let bootstrapContent: string;
  try {
    bootstrapContent = await fs.readFile(bootstrapPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }

  const bootstrapMetadata = parseManagedMetadata(bootstrapContent);
  if (!bootstrapMetadata) {
    return undefined;
  }

  const topicsRootPath = path.join(managedRootPath, "core", "topics");
  const topicFiles = await collectFilePathsRecursive(topicsRootPath);
  const selectedTopics: SelectedTopic[] = [];

  for (const topicFullPath of topicFiles) {
    const topicContent = await fs.readFile(topicFullPath, "utf8");
    const topicMetadata = parseManagedMetadata(topicContent);
    if (!topicMetadata) {
      continue;
    }

    if (
      topicMetadata.bundleId !== bootstrapMetadata.bundleId ||
      topicMetadata.bundleVersion !== bootstrapMetadata.bundleVersion ||
      topicMetadata.extensionVersion !== bootstrapMetadata.extensionVersion
    ) {
      traceLogger.log("warning", "operation_blocked", {
        reason: "repair_recovery_metadata_mismatch"
      });
      return undefined;
    }

    const normalizedRelativeTopicPath = path
      .relative(topicsRootPath, topicFullPath)
      .split(path.sep)
      .join(path.posix.sep);

    const category = path.posix.dirname(normalizedRelativeTopicPath);
    selectedTopics.push({
      file_id: topicMetadata.artifactId,
      path: `topics/${normalizedRelativeTopicPath}`,
      category,
      required: false,
      reasons: ["derived_from_managed_files"]
    });
  }

  selectedTopics.sort((left, right) => left.path.localeCompare(right.path));

  return {
    bundleId: bootstrapMetadata.bundleId,
    bundleVersion: bootstrapMetadata.bundleVersion,
    extensionVersion: bootstrapMetadata.extensionVersion,
    selectedTopics
  };
}

function buildSelectedTopicsFromState(state: ManagedState): SelectedTopic[] {
  const topicsPrefix = ".codex-onboarding/core/topics/";

  const selected = state.managed_files
    .filter((item) => item.relative_path.startsWith(topicsPrefix))
    .map((item) => {
      const normalizedTopicPath = item.relative_path.slice(topicsPrefix.length);
      const topicPath = `topics/${normalizedTopicPath}`;
      const category = path.posix.dirname(normalizedTopicPath);

      return {
        file_id: item.file_id,
        path: topicPath,
        category,
        required: false,
        reasons: ["derived_from_managed_state"]
      } as SelectedTopic;
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  return selected;
}

interface DriftedManagedFile {
  relativePath: string;
  reason: "missing" | "modified";
}

async function collectDriftedManagedFiles(
  targetRootPath: string,
  state: ManagedState
): Promise<DriftedManagedFile[]> {
  const drifted: DriftedManagedFile[] = [];

  for (const managedFile of state.managed_files) {
    const fullPath = path.join(targetRootPath, managedFile.relative_path);

    let existingContent: string;
    try {
      existingContent = await fs.readFile(fullPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        drifted.push({
          relativePath: managedFile.relative_path,
          reason: "missing"
        });
        continue;
      }

      throw error;
    }

    const existingDigest = digestSha256(existingContent);
    if (existingDigest !== managedFile.content_digest_sha256) {
      drifted.push({
        relativePath: managedFile.relative_path,
        reason: "modified"
      });
    }
  }

  return drifted;
}

async function askDriftResetConfirmation(driftedFiles: DriftedManagedFile[]): Promise<boolean> {
  const modifiedCount = driftedFiles.filter((item) => item.reason === "modified").length;
  const missingCount = driftedFiles.filter((item) => item.reason === "missing").length;

  const decision = await vscode.window.showQuickPick(
    [
      {
        label: "Reset Managed Files (Discard Local Changes)",
        description:
          "Overwrite edited managed files and recreate missing managed files from the current managed version.",
        value: "reset"
      },
      {
        label: "Cancel Repair",
        description: "Keep local files unchanged and stop repair.",
        value: "cancel"
      }
    ],
    {
      title: "Repair Warning: Managed File Drift Detected",
      placeHolder: `${driftedFiles.length} managed files changed (modified: ${modifiedCount}, missing: ${missingCount}).`
    }
  );

  return decision?.value === "reset";
}

export async function runRepair(
  context: vscode.ExtensionContext,
  logger: OutputLogger
): Promise<void> {
  const operationId = `repair-${Date.now()}`;
  let traceLogger: OperationTraceLogger | undefined;
  let targetRootPath: string | undefined;
  let projectLogPath: string | undefined;
  let shouldMirrorProjectLog = false;

  try {
    traceLogger = await OperationTraceLogger.create(context, logger, "repair", operationId);

    traceLogger.log("debug", "operation_started", {
      log_file: traceLogger.logFilePath
    });

    const target = await resolveTargetWorkspaceFolder();
    if (!target) {
      if (isWorkspaceSelectionCancelled()) {
        traceLogger.log("warning", "operation_blocked", {
          reason: "target_scope_cancelled"
        });
        void vscode.window.showInformationMessage("Repair canceled at Installation Scope.");
        return;
      }

      traceLogger.log("warning", "operation_blocked", {
        reason: "no_workspace_folder"
      });
      void vscode.window.showWarningMessage("No workspace folder is available for repair operation.");
      return;
    }

    traceLogger.log("debug", "target_resolved", {
      target_root: target.uri.fsPath
    });
    targetRootPath = target.uri.fsPath;

    const stateLoad = await readManagedState(target.uri.fsPath);
    traceLogger.log("debug", "state_loaded", {
      state_path: path.join(target.uri.fsPath, ".codex-onboarding", ".managed", "state.json"),
      state_status: stateLoad.status,
      managed_file_count: stateLoad.state?.managed_files.length ?? 0
    });

    let bundleId: string;
    let bundleVersion: string;
    let extensionVersion: string;
    let selectedTopics: SelectedTopic[];
    let driftedManagedFiles: DriftedManagedFile[] = [];

    if (stateLoad.state && stateLoad.state.managed_files.length > 0) {
      bundleId = stateLoad.state.bundle_id;
      bundleVersion = stateLoad.state.bundle_version;
      extensionVersion = stateLoad.state.extension_version;
      selectedTopics = buildSelectedTopicsFromState(stateLoad.state);
      driftedManagedFiles = await collectDriftedManagedFiles(target.uri.fsPath, stateLoad.state);
    } else {
      const recoveredSource = await recoverRepairSourceFromManagedFiles(target.uri.fsPath, traceLogger);
      if (!recoveredSource) {
        traceLogger.log("warning", "operation_blocked", {
          reason: "repair_requires_existing_install"
        });
        void vscode.window.showWarningMessage(
          "No existing managed onboarding artifacts were found in this workspace. Run Install first."
        );
        return;
      }

      bundleId = recoveredSource.bundleId;
      bundleVersion = recoveredSource.bundleVersion;
      extensionVersion = recoveredSource.extensionVersion;
      selectedTopics = recoveredSource.selectedTopics;

      traceLogger.log("warning", "repair_state_recovered", {
        recovery_source: stateLoad.status === "corrupt" ? "corrupt_state_managed_files" : "missing_state_managed_files",
        recovered_topic_count: selectedTopics.length
      });
    }

    traceLogger.log("debug", "repair_drift_scan_completed", {
      drifted_managed_count: driftedManagedFiles.length
    });

    let forceResetModifiedManagedFiles = false;
    if (driftedManagedFiles.length > 0) {
      traceLogger.log("debug", "operational_question_asked", {
        question_id: "repair_drift_reset_confirmation"
      });
      const confirmedReset = await askDriftResetConfirmation(driftedManagedFiles);
      if (!confirmedReset) {
        traceLogger.log("warning", "operation_blocked", {
          reason: "repair_drift_reset_declined",
          drifted_managed_count: driftedManagedFiles.length
        });
        void vscode.window.showInformationMessage("Repair canceled.");
        return;
      }

      forceResetModifiedManagedFiles = true;
      traceLogger.log("debug", "repair_drift_reset_confirmed", {
        drifted_managed_count: driftedManagedFiles.length
      });
    }

    const gitRepositoryAvailable = await hasGitRepository(target.uri.fsPath);
    const gitTrackingQuestionSkipped = !gitRepositoryAvailable;
    let operationalSelections: OperationalSelections;

    if (gitRepositoryAvailable) {
      traceLogger.log("debug", "operational_question_asked", {
        question_id: "repair_git_tracking_preference"
      });
      const selections = await askOperationalSelectionsForRepair();
      if (!selections) {
        traceLogger.log("warning", "operation_blocked", {
          reason: "operational_questions_cancelled"
        });
        void vscode.window.showInformationMessage("Repair canceled at Repair Options.");
        return;
      }

      operationalSelections = selections;
    } else {
      operationalSelections = { gitMode: "track" };
      traceLogger.log("debug", "git_tracking_question_skipped", {
        reason: "no_git_repository"
      });
    }

    traceLogger.log("debug", "git_tracking_selected", {
      git_mode: operationalSelections.gitMode
    });

    const gitTrackingResult = await applyGitTrackingMode(
      {
        targetRootPath: target.uri.fsPath,
        mode: operationalSelections.gitMode
      },
      traceLogger
    );

    if (gitTrackingResult.strategy === "no_git_repository") {
      void vscode.window.showWarningMessage(
        "Selected workspace root is not a Git repository. Git tracking preference was skipped."
      );
    }

    const result = await applyManagedInstall(
      {
        extensionPath: context.extensionPath,
        targetRootPath: target.uri.fsPath,
        bundleId,
        bundleVersion,
        extensionVersion,
        selectedTopics,
        mode: "repair",
        forceResetModifiedManagedFiles
      },
      traceLogger
    );
    const rootAgentsCleanup = await removeRootAgentsIntegration(target.uri.fsPath, traceLogger);
    projectLogPath = buildProjectOperationLogPath(target.uri.fsPath, traceLogger.logFilePath);

    const summary = [
      "Repair operation completed.",
      `Target root: ${target.uri.fsPath}`,
      `Git mode: ${gitTrackingQuestionSkipped ? "not_applicable" : operationalSelections.gitMode}`,
      `Git tracking strategy: ${gitTrackingResult.strategy}`,
      `Git tracking updated: ${gitTrackingResult.updated ? "yes" : "no"}`,
      `Managed drift detected: ${driftedManagedFiles.length}`,
      `Drift reset mode: ${forceResetModifiedManagedFiles ? "confirmed" : "not_required"}`,
      ...(gitTrackingQuestionSkipped
        ? [
            "Git tracking question: skipped because selected root is not a Git repository.",
            "To configure tracking/ignoring later, initialize Git and run Install or Repair again."
          ]
        : []),
      `Managed bundle: ${bundleId}@${bundleVersion}`,
      `Managed topics from state: ${selectedTopics.length}`,
      `Root AGENTS cleanup: ${rootAgentsCleanup.status}`,
      `Applied or synchronized files: ${result.appliedFiles.length}`,
      `Recovered tracked files: ${result.recoveredTrackedFiles.length}`,
      `Skipped files: ${result.skippedFiles.length}`,
      `Removed stale managed files: ${result.removedStaleFiles.length}`,
      `Managed state: ${result.statePath}`,
      ...(result.appliedArtifactsReportPath
        ? [`Applied artifacts report: ${result.appliedArtifactsReportPath}`]
        : []),
      `Project operation log: ${projectLogPath}`,
      `Operation log: ${traceLogger.logFilePath}`
    ].join("\n");

    shouldMirrorProjectLog = true;

    void vscode.window.showInformationMessage(summary);

    traceLogger.log("debug", "success_notification_shown", {
      managed_bundle_id: bundleId,
      git_tracking_strategy: gitTrackingResult.strategy,
      applied_count: result.appliedFiles.length,
      recovered_count: result.recoveredTrackedFiles.length,
      skipped_count: result.skippedFiles.length,
      removed_stale_count: result.removedStaleFiles.length
    });

    traceLogger.log("debug", "operation_completed", {
      result_code: "repaired"
    });
  } catch (error) {
    logger.show();

    if (traceLogger) {
      traceLogger.log("error", "operation_completed", {
        result_code: "failed",
        reason: error instanceof Error ? error.message : "unknown_error"
      });
    } else {
      logger.log("error", "operation_completed", {
        operation_id: operationId,
        command: "repair",
        result_code: "failed",
        reason: error instanceof Error ? error.message : "unknown_error"
      });
    }

    void vscode.window.showErrorMessage(
      error instanceof Error ? `Repair failed: ${error.message}` : "Repair failed: unknown error"
    );
  } finally {
    if (traceLogger) {
      await traceLogger.flush();
    }

    if (traceLogger && shouldMirrorProjectLog && targetRootPath && projectLogPath) {
      try {
        await mirrorOperationLogToProject(targetRootPath, traceLogger.logFilePath, logger);
      } catch (error) {
        logger.log("warning", "operation_log_mirror_failed", {
          command: "repair",
          target_root: targetRootPath,
          reason: error instanceof Error ? error.message : "unknown_error"
        });
      }
    }
  }
}
