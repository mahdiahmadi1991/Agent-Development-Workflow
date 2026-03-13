import * as vscode from "vscode";

import { OperationalSelections } from "../contracts/questionnaire";
import { applyManagedInstall } from "../services/managedInstallService";
import { OperationTraceLogger } from "../services/operationTraceLogger";
import { OutputLogger } from "../services/outputLogger";
import { openPostInstallGuidancePage } from "../services/postInstallGuidancePage";
import { loadQuestionnaireAssets } from "../services/questionnaireAssetService";
import { runDynamicQuestionFlow } from "../services/questionnaireFlowRunner";
import { resolveTargetWorkspaceFolder } from "../services/workspaceRootResolver";

function createOperationId(): string {
  return `install-${Date.now()}`;
}

async function askOperationalSelections(): Promise<OperationalSelections | undefined> {
  const gitMode = await vscode.window.showQuickPick(
    [
      { label: "Track managed files", value: "track" as const },
      { label: "Add managed paths to .gitignore", value: "ignore" as const }
    ],
    {
      title: "Operational Questions: Settings",
      placeHolder: "Choose Git mode for managed onboarding files"
    }
  );

  if (!gitMode) {
    return undefined;
  }

  return { gitMode: gitMode.value };
}

async function askPreInstallAcknowledgement(input: {
  targetRootPath: string;
  selectedProfile: string;
  gitMode: "track" | "ignore";
}): Promise<boolean> {
  const detail = [
    "The install operation applies extension-managed onboarding artifacts.",
    "Existing files are not overwritten (non-destructive mode).",
    "Managed state will be written to codex-onboarding/.managed/state.json.",
    `Target root: ${input.targetRootPath}`,
    `Selected profile: ${input.selectedProfile}`,
    `Git mode: ${input.gitMode}`
  ].join("\n");

  const decision = await vscode.window.showInformationMessage(
    "Review and confirm onboarding install behavior before apply.",
    {
      modal: true,
      detail
    },
    "Apply"
  );

  return decision === "Apply";
}

export async function runInstall(
  context: vscode.ExtensionContext,
  logger: OutputLogger
): Promise<void> {
  const operationId = createOperationId();
  let traceLogger: OperationTraceLogger | undefined;

  try {
    traceLogger = await OperationTraceLogger.create(context, logger, "install", operationId);

    traceLogger.log("debug", "operation_started", {
      log_file: traceLogger.logFilePath
    });

    const target = await resolveTargetWorkspaceFolder();
    if (!target) {
      traceLogger.log("warning", "operation_blocked", {
        reason: "no_workspace_folder"
      });
      void vscode.window.showWarningMessage("No workspace folder is available for install operation.");
      return;
    }

    traceLogger.log("debug", "target_resolved", {
      target_root: target.uri.fsPath
    });

    const operationalSelections = await askOperationalSelections();
    if (!operationalSelections) {
      traceLogger.log("warning", "operation_blocked", {
        reason: "operational_questions_cancelled"
      });
      return;
    }

    traceLogger.log("debug", "operational_question_asked", {
      git_mode: operationalSelections.gitMode
    });

    const questionnaire = await loadQuestionnaireAssets(context.extensionPath, "dotnet-csharp");

    traceLogger.log("debug", "dynamic_question_flow_loaded", {
      family: questionnaire.family,
      index_path: questionnaire.indexPath,
      flow_path: questionnaire.flowPath
    });

    const profileSelectionAnswers = await runDynamicQuestionFlow(
      questionnaire.flow,
      traceLogger,
      operationId
    );
    if (!profileSelectionAnswers) {
      traceLogger.log("warning", "operation_blocked", {
        reason: "profile_selection_questions_cancelled"
      });
      return;
    }

    const selectedProfile = profileSelectionAnswers.answers.root ?? "unknown";

    const acknowledged = await askPreInstallAcknowledgement({
      targetRootPath: target.uri.fsPath,
      selectedProfile,
      gitMode: operationalSelections.gitMode
    });

    if (!acknowledged) {
      traceLogger.log("warning", "operation_blocked", {
        reason: "pre_install_acknowledgement_declined"
      });
      return;
    }

    const extensionVersion =
      typeof context.extension.packageJSON?.version === "string"
        ? context.extension.packageJSON.version
        : "0.0.0";

    const installResult = await applyManagedInstall(
      {
        extensionPath: context.extensionPath,
        targetRootPath: target.uri.fsPath,
        bundleId: `dotnet-csharp-${selectedProfile}`,
        bundleVersion: String(questionnaire.flow.version),
        extensionVersion
      },
      traceLogger
    );

    const summary = [
      "Install foundation step completed.",
      `Target root: ${target.uri.fsPath}`,
      `Git mode (Operational Questions): ${operationalSelections.gitMode}`,
      `Selected profile (Profile Selection Questions): ${selectedProfile}`,
      `Applied files: ${installResult.appliedFiles.length}`,
      `Skipped files: ${installResult.skippedFiles.length}`,
      `Managed state: ${installResult.statePath}`,
      `Operation log: ${traceLogger.logFilePath}`
    ].join("\n");

    void vscode.window.showInformationMessage(summary, { modal: false });
    traceLogger.log("debug", "success_notification_shown", {
      target_profile: selectedProfile,
      applied_count: installResult.appliedFiles.length,
      skipped_count: installResult.skippedFiles.length
    });

    await openPostInstallGuidancePage({
      targetRootPath: target.uri.fsPath,
      selectedProfile,
      logFilePath: traceLogger.logFilePath
    });

    traceLogger.log("debug", "post_install_page_opened", {
      target_profile: selectedProfile
    });

    traceLogger.log("debug", "operation_completed", {
      result_code: installResult.appliedFiles.length > 0 ? "applied" : "completed_with_skips",
      target_profile: selectedProfile
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
        command: "install",
        result_code: "failed",
        reason: error instanceof Error ? error.message : "unknown_error"
      });
    }

    void vscode.window.showErrorMessage(
      error instanceof Error ? `Install failed: ${error.message}` : "Install failed: unknown error"
    );
  } finally {
    if (traceLogger) {
      await traceLogger.flush();
    }
  }
}
