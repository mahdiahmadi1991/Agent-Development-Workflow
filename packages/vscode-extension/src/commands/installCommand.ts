import * as vscode from "vscode";

import { GroupASelections } from "../contracts/questionnaire";
import { OutputLogger } from "../services/outputLogger";
import { loadQuestionnaireAssets } from "../services/questionnaireAssetService";
import { runDynamicQuestionFlow } from "../services/questionnaireFlowRunner";
import { resolveTargetWorkspaceFolder } from "../services/workspaceRootResolver";

function createOperationId(): string {
  return `install-${Date.now()}`;
}

async function askGroupASelections(): Promise<GroupASelections | undefined> {
  const gitMode = await vscode.window.showQuickPick(
    [
      { label: "Track managed files", value: "track" as const },
      { label: "Add managed paths to .gitignore", value: "ignore" as const }
    ],
    {
      title: "Group A: Operational settings",
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
  logger.log("debug", "operation_started", { command: "install", operation_id: operationId });

  try {
    const target = await resolveTargetWorkspaceFolder();
    if (!target) {
      logger.log("warning", "operation_blocked", {
        operation_id: operationId,
        reason: "no_workspace_folder"
      });
      void vscode.window.showWarningMessage("No workspace folder is available for install operation.");
      return;
    }

    const groupA = await askGroupASelections();
    if (!groupA) {
      logger.log("warning", "operation_blocked", {
        operation_id: operationId,
        reason: "group_a_cancelled"
      });
      return;
    }

    logger.log("debug", "operational_question_asked", {
      operation_id: operationId,
      git_mode: groupA.gitMode
    });

    const questionnaire = await loadQuestionnaireAssets(context.extensionPath, "dotnet-csharp");

    logger.log("debug", "dynamic_question_flow_loaded", {
      operation_id: operationId,
      family: questionnaire.family,
      index_path: questionnaire.indexPath,
      flow_path: questionnaire.flowPath
    });

    const groupB = await runDynamicQuestionFlow(questionnaire.flow, logger, operationId);
    if (!groupB) {
      logger.log("warning", "operation_blocked", {
        operation_id: operationId,
        reason: "group_b_cancelled"
      });
      return;
    }

    const selectedProfile = groupB.answers.root ?? "unknown";

    const summary = [
      "Install foundation step completed.",
      `Target root: ${target.uri.fsPath}`,
      `Git mode (Group A): ${groupA.gitMode}`,
      `Selected profile (Group B): ${selectedProfile}`,
      `Question flow family: ${questionnaire.family}`
    ].join("\n");

    void vscode.window.showInformationMessage(summary, { modal: false });
    logger.log("debug", "operation_completed", {
      operation_id: operationId,
      result_code: "foundation_completed",
      profile: selectedProfile
    });
  } catch (error) {
    logger.log("error", "operation_completed", {
      operation_id: operationId,
      result_code: "failed",
      reason: error instanceof Error ? error.message : "unknown_error"
    });
    void vscode.window.showErrorMessage(
      error instanceof Error ? `Install failed: ${error.message}` : "Install failed: unknown error"
    );
  }
}
