import * as vscode from "vscode";

import { applyGitTrackingMode } from "../services/gitTrackingService";
import {
  analyzeManagedRemoveImpact,
  removeManagedOnboarding
} from "../services/managedRemoveService";
import { OperationTraceLogger } from "../services/operationTraceLogger";
import { OutputLogger } from "../services/outputLogger";
import { removeRootAgentsIntegration } from "../services/rootAgentsIntegrationService";
import { resolveTargetWorkspaceFolder } from "../services/workspaceRootResolver";

function isWorkspaceSelectionCancelled(): boolean {
  return (vscode.workspace.workspaceFolders ?? []).length > 0;
}

async function askRemoveConfirmationForDetectedChanges(input: {
  targetRootPath: string;
  modifiedManagedCount: number;
  missingManagedCount: number;
  untrackedCount: number;
  stateCorrupt: boolean;
}): Promise<boolean> {
  const decision = await vscode.window.showQuickPick(
    [
      {
        label: "Remove Entire .codex-onboarding Folder (Discard Changes)",
        description: "Delete managed files and all additional files currently under .codex-onboarding."
      },
      {
        label: "No",
        description: "Cancel remove operation."
      }
    ],
    {
      title: "Remove Warning: Local Changes Detected",
      placeHolder:
        `Target root: ${input.targetRootPath} | modified: ${input.modifiedManagedCount}, ` +
        `missing: ${input.missingManagedCount}, additional files: ${input.untrackedCount}, ` +
        `state corrupt: ${input.stateCorrupt ? "yes" : "no"}`
    }
  );

  if (!decision || decision.label !== "Remove Entire .codex-onboarding Folder (Discard Changes)") {
    void vscode.window.showInformationMessage("Remove canceled.");
    return false;
  }

  return true;
}

export async function runRemove(
  context: vscode.ExtensionContext,
  logger: OutputLogger
): Promise<void> {
  const operationId = `remove-${Date.now()}`;
  let traceLogger: OperationTraceLogger | undefined;

  try {
    traceLogger = await OperationTraceLogger.create(context, logger, "remove", operationId);

    traceLogger.log("debug", "operation_started", {
      log_file: traceLogger.logFilePath
    });

    const target = await resolveTargetWorkspaceFolder();
    if (!target) {
      if (isWorkspaceSelectionCancelled()) {
        traceLogger.log("warning", "operation_blocked", {
          reason: "target_scope_cancelled"
        });
        void vscode.window.showInformationMessage("Remove canceled at Installation Scope.");
        return;
      }

      traceLogger.log("warning", "operation_blocked", {
        reason: "no_workspace_folder"
      });
      void vscode.window.showWarningMessage("No workspace folder is available for remove operation.");
      return;
    }

    traceLogger.log("debug", "target_resolved", {
      target_root: target.uri.fsPath
    });

    const removeImpact = await analyzeManagedRemoveImpact(target.uri.fsPath, traceLogger);
    traceLogger.log("debug", "remove_impact_scan_completed", {
      state_corrupt: removeImpact.stateCorrupt,
      modified_managed_count: removeImpact.modifiedManagedFiles.length,
      missing_managed_count: removeImpact.missingManagedFiles.length,
      additional_files_count: removeImpact.untrackedFiles.length,
      remove_requires_confirmation: removeImpact.requiresConfirmation
    });

    if (removeImpact.requiresConfirmation) {
      traceLogger.log("debug", "operational_question_asked", {
        question_id: "remove_drift_confirmation"
      });
      const confirmed = await askRemoveConfirmationForDetectedChanges({
        targetRootPath: target.uri.fsPath,
        modifiedManagedCount: removeImpact.modifiedManagedFiles.length,
        missingManagedCount: removeImpact.missingManagedFiles.length,
        untrackedCount: removeImpact.untrackedFiles.length,
        stateCorrupt: removeImpact.stateCorrupt
      });
      if (!confirmed) {
        traceLogger.log("warning", "operation_blocked", {
          reason: "remove_confirmation_declined_after_drift_warning"
        });
        return;
      }
    }

    const gitTrackingResult = await applyGitTrackingMode(
      {
        targetRootPath: target.uri.fsPath,
        mode: "track"
      },
      traceLogger
    );

    const result = await removeManagedOnboarding(target.uri.fsPath, traceLogger, {
      removeWholeManagedRoot: removeImpact.requiresConfirmation
    });
    const rootAgentsCleanup = await removeRootAgentsIntegration(target.uri.fsPath, traceLogger);

    const summary = [
      "Remove operation completed.",
      `Target root: ${target.uri.fsPath}`,
      `Remove mode: ${result.removeMode}`,
      `Root AGENTS cleanup: ${rootAgentsCleanup.status}`,
      `Git tracking cleanup strategy: ${gitTrackingResult.strategy}`,
      `Git tracking cleanup updated: ${gitTrackingResult.updated ? "yes" : "no"}`,
      `Detected modified managed files: ${removeImpact.modifiedManagedFiles.length}`,
      `Detected missing managed files: ${removeImpact.missingManagedFiles.length}`,
      `Detected additional user files: ${removeImpact.untrackedFiles.length}`,
      `Removed managed files: ${result.removedFiles.length}`,
      `Skipped changed managed files: ${result.skippedChangedManagedFiles.length}`,
      `Missing managed files in state: ${result.missingManagedFiles.length}`,
      `Managed root removed: ${result.removedManagedRoot ? "yes" : "no"}`,
      `State cleared: ${result.stateCleared ? "yes" : "no"}`,
      `Operation log: ${traceLogger.logFilePath}`
    ].join("\n");

    void vscode.window.showInformationMessage(summary);

    traceLogger.log("debug", "success_notification_shown", {
      remove_mode: result.removeMode,
      removed_count: result.removedFiles.length,
      git_tracking_cleanup_strategy: gitTrackingResult.strategy,
      skipped_changed_count: result.skippedChangedManagedFiles.length,
      missing_count: result.missingManagedFiles.length,
      state_cleared: result.stateCleared,
      removed_managed_root: result.removedManagedRoot
    });

    traceLogger.log("debug", "operation_completed", {
      result_code: "removed"
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
        command: "remove",
        result_code: "failed",
        reason: error instanceof Error ? error.message : "unknown_error"
      });
    }

    void vscode.window.showErrorMessage(
      error instanceof Error ? `Remove failed: ${error.message}` : "Remove failed: unknown error"
    );
  } finally {
    if (traceLogger) {
      await traceLogger.flush();
    }
  }
}
