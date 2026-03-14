import * as vscode from "vscode";

import { removeManagedOnboarding } from "../services/managedRemoveService";
import { OperationTraceLogger } from "../services/operationTraceLogger";
import { OutputLogger } from "../services/outputLogger";
import { resolveTargetWorkspaceFolder } from "../services/workspaceRootResolver";

function isWorkspaceSelectionCancelled(): boolean {
  return (vscode.workspace.workspaceFolders ?? []).length > 0;
}

async function askRemoveConfirmation(targetRootPath: string): Promise<boolean> {
  const decision = await vscode.window.showWarningMessage(
    "Review & Remove: remove managed onboarding artifacts from the selected workspace root?",
    {
      modal: true,
      detail: [
        "Only unchanged managed files are removed.",
        "Consumer-modified managed files are preserved.",
        "Managed state will be cleared.",
        `Target root: ${targetRootPath}`
      ].join("\n")
    },
    "Continue"
  );

  if (decision !== "Continue") {
    void vscode.window.showInformationMessage("Remove canceled at Review & Remove.");
    return false;
  }

  const typedConfirmation = await vscode.window.showInputBox({
    title: "Remove Confirmation",
    prompt: "Type REMOVE to confirm managed artifact removal.",
    placeHolder: "REMOVE",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim() === "REMOVE" ? undefined : "Type REMOVE exactly to confirm.")
  });

  if (typedConfirmation === undefined) {
    void vscode.window.showInformationMessage("Remove canceled at typed confirmation.");
    return false;
  }

  if (typedConfirmation.trim() !== "REMOVE") {
    void vscode.window.showWarningMessage("Remove canceled: confirmation text did not match.");
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

    const confirmed = await askRemoveConfirmation(target.uri.fsPath);
    if (!confirmed) {
      traceLogger.log("warning", "operation_blocked", {
        reason: "remove_confirmation_declined"
      });
      return;
    }

    const result = await removeManagedOnboarding(target.uri.fsPath, traceLogger);

    const summary = [
      "Remove operation completed.",
      `Target root: ${target.uri.fsPath}`,
      `Removed managed files: ${result.removedFiles.length}`,
      `Preserved modified managed files: ${result.preservedModifiedFiles.length}`,
      `Missing managed files in state: ${result.missingManagedFiles.length}`,
      `State cleared: ${result.stateCleared ? "yes" : "no"}`,
      `Operation log: ${traceLogger.logFilePath}`
    ].join("\n");

    void vscode.window.showInformationMessage(summary);

    traceLogger.log("debug", "success_notification_shown", {
      removed_count: result.removedFiles.length,
      preserved_modified_count: result.preservedModifiedFiles.length,
      missing_count: result.missingManagedFiles.length,
      state_cleared: result.stateCleared
    });

    traceLogger.log("debug", "operation_completed", {
      result_code: "removed"
    });
  } catch (error) {
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
