import * as vscode from "vscode";

import { OperationalSelections } from "../contracts/questionnaire";
import { applyGitTrackingMode } from "../services/gitTrackingService";
import { applyManagedInstall } from "../services/managedInstallService";
import { OperationTraceLogger } from "../services/operationTraceLogger";
import { OutputLogger } from "../services/outputLogger";
import { loadResolvedProfile } from "../services/profileAssetService";
import { loadQuestionnaireAssets } from "../services/questionnaireAssetService";
import { runDynamicQuestionFlow } from "../services/questionnaireFlowRunner";
import { resolveSelectionPlan } from "../services/selectionResolver";
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

async function askRepairConfirmation(input: {
  targetRootPath: string;
  selectedProfile: string;
  selectedTopicCount: number;
}): Promise<boolean> {
  const decision = await vscode.window.showInformationMessage(
    "Review & Repair: confirm managed state reconciliation.",
    {
      modal: true,
      detail: [
        "Repair recreates missing managed files and re-syncs unchanged tracked files.",
        "Repair remains non-destructive for untracked consumer files.",
        `Target root: ${input.targetRootPath}`,
        `Selected profile: ${input.selectedProfile}`,
        `Selected topics: ${input.selectedTopicCount}`
      ].join("\n")
    },
    "Apply Repair"
  );

  return decision === "Apply Repair";
}

export async function runRepair(
  context: vscode.ExtensionContext,
  logger: OutputLogger
): Promise<void> {
  const operationId = `repair-${Date.now()}`;
  let traceLogger: OperationTraceLogger | undefined;

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

    const operationalSelections = await askOperationalSelectionsForRepair();
    if (!operationalSelections) {
      traceLogger.log("warning", "operation_blocked", {
        reason: "operational_questions_cancelled"
      });
      void vscode.window.showInformationMessage("Repair canceled at Repair Options.");
      return;
    }

    traceLogger.log("debug", "operational_question_asked", {
      git_mode: operationalSelections.gitMode
    });

    const family = "dotnet-csharp";
    const questionnaire = await loadQuestionnaireAssets(context.extensionPath, family);

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
      void vscode.window.showInformationMessage("Repair canceled at Project Profile.");
      return;
    }

    const selectedProfileOption = profileSelectionAnswers.answers.root ?? "unknown";
    const resolvedProfile = await loadResolvedProfile(
      context.extensionPath,
      family,
      selectedProfileOption
    );

    const selectionPlan = await resolveSelectionPlan(
      {
        extensionPath: context.extensionPath,
        family,
        profileId: resolvedProfile.profile_id,
        baselineTopicIds: resolvedProfile.baseline_topics,
        defaultCapabilities: resolvedProfile.default_capabilities,
        questionAnswers: profileSelectionAnswers.answers
      },
      traceLogger
    );

    const confirmed = await askRepairConfirmation({
      targetRootPath: target.uri.fsPath,
      selectedProfile: resolvedProfile.profile_id,
      selectedTopicCount: selectionPlan.selected_topics.length
    });

    if (!confirmed) {
      traceLogger.log("warning", "operation_blocked", {
        reason: "repair_confirmation_declined"
      });
      void vscode.window.showInformationMessage("Repair canceled at Review & Repair.");
      return;
    }

    const extensionVersion =
      typeof context.extension.packageJSON?.version === "string"
        ? context.extension.packageJSON.version
        : "0.0.0";

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
        bundleId: resolvedProfile.profile_id,
        bundleVersion: String(questionnaire.flow.version),
        extensionVersion,
        selectedTopics: selectionPlan.selected_topics,
        mode: "repair"
      },
      traceLogger
    );

    const summary = [
      "Repair operation completed.",
      `Target root: ${target.uri.fsPath}`,
      `Git mode: ${operationalSelections.gitMode}`,
      `Git tracking strategy: ${gitTrackingResult.strategy}`,
      `Git tracking updated: ${gitTrackingResult.updated ? "yes" : "no"}`,
      `Selected profile: ${resolvedProfile.profile_id}`,
      `Selected topics: ${selectionPlan.selected_topics.length}`,
      `Applied or synchronized files: ${result.appliedFiles.length}`,
      `Recovered tracked files: ${result.recoveredTrackedFiles.length}`,
      `Skipped files: ${result.skippedFiles.length}`,
      `Removed stale managed files: ${result.removedStaleFiles.length}`,
      `Managed state: ${result.statePath}`,
      `Operation log: ${traceLogger.logFilePath}`
    ].join("\n");

    void vscode.window.showInformationMessage(summary);

    traceLogger.log("debug", "success_notification_shown", {
      target_profile: resolvedProfile.profile_id,
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
  }
}
