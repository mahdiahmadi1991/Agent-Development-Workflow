import * as vscode from "vscode";

import { OperationalSelections } from "../contracts/questionnaire";
import { OperationTraceLogger } from "../services/operationTraceLogger";
import { OutputLogger } from "../services/outputLogger";
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

    const summary = [
      "Install foundation step completed.",
      `Target root: ${target.uri.fsPath}`,
      `Git mode (Operational Questions): ${operationalSelections.gitMode}`,
      `Selected profile (Profile Selection Questions): ${selectedProfile}`,
      `Question flow family: ${questionnaire.family}`,
      `Operation log: ${traceLogger.logFilePath}`
    ].join("\n");

    void vscode.window.showInformationMessage(summary, { modal: false });
    traceLogger.log("debug", "success_notification_shown", {
      target_profile: selectedProfile
    });

    traceLogger.log("debug", "operation_completed", {
      result_code: "foundation_completed",
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
