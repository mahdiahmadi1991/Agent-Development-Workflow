import * as vscode from "vscode";

import { OperationalSelections } from "../contracts/questionnaire";
import { applyGitTrackingMode, hasGitRepository } from "../services/gitTrackingService";
import { applyManagedInstall } from "../services/managedInstallService";
import { OperationTraceLogger } from "../services/operationTraceLogger";
import { OutputLogger } from "../services/outputLogger";
import { openPostInstallGuidancePage } from "../services/postInstallGuidancePage";
import { loadResolvedProfile } from "../services/profileAssetService";
import { loadQuestionnaireAssets } from "../services/questionnaireAssetService";
import { runDynamicQuestionFlow } from "../services/questionnaireFlowRunner";
import { resolveSelectionPlan } from "../services/selectionResolver";
import { requireUpdateConsentIfNeeded } from "../services/updateConsentService";
import { resolveTargetWorkspaceFolder } from "../services/workspaceRootResolver";

function createOperationId(): string {
  return `install-${Date.now()}`;
}

function resolveRepositoryUrl(packageJson: unknown): string | undefined {
  if (!packageJson || typeof packageJson !== "object") {
    return undefined;
  }

  const repository = (packageJson as { repository?: unknown }).repository;
  if (typeof repository === "string") {
    return repository;
  }

  if (!repository || typeof repository !== "object") {
    return undefined;
  }

  const url = (repository as { url?: unknown }).url;
  return typeof url === "string" ? url : undefined;
}

function isWorkspaceSelectionCancelled(): boolean {
  return (vscode.workspace.workspaceFolders ?? []).length > 0;
}

async function askGitTrackingSelectionAtFinalStep(): Promise<OperationalSelections | undefined> {
  const gitMode = await vscode.window.showQuickPick(
    [
      {
        label: "Track in Git (Recommended)",
        description: "Managed onboarding files stay versioned in your repository.",
        value: "track" as const
      },
      {
        label: "Ignore in Local Git Metadata",
        description: "Managed onboarding files are ignored via .git/info/exclude.",
        value: "ignore" as const
      }
    ],
    {
      title: "Review & Apply: Git Tracking",
      placeHolder: "Should extension-managed onboarding files be tracked in Git?"
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
  gitModeSummary: string;
  selectedTopicCount: number;
  previewTopicIds: string[];
}): Promise<boolean> {
  const preview =
    input.previewTopicIds.length > 0 ? input.previewTopicIds.map((item) => `- ${item}`).join("\n") : "- (none)";

  const detail = [
    "What will happen:",
    "- Extension-managed onboarding artifacts will be applied.",
    "- Existing files are not overwritten (non-destructive mode).",
    "- Managed state will be written to .codex-onboarding/.managed/state.json.",
    "",
    "Selected configuration:",
    `- Target root: ${input.targetRootPath}`,
    `- Project profile: ${input.selectedProfile}`,
    `- Git mode: ${input.gitModeSummary}`,
    `- Selected topics: ${input.selectedTopicCount}`,
    "",
    "Topic preview:",
    preview
  ].join("\n");

  const decision = await vscode.window.showInformationMessage(
    "Review & Apply: confirm onboarding installation.",
    {
      modal: true,
      detail
    },
    "Apply Installation"
  );

  return decision === "Apply Installation";
}

function buildGitTrackingSummaryLines(input: {
  gitMode: "track" | "ignore";
  gitTrackingStrategy: "git_info_exclude" | "no_git_repository";
  gitTrackingUpdated: boolean;
  gitQuestionSkipped: boolean;
}): string[] {
  const lines = [
    `Git mode (Review & Apply): ${input.gitQuestionSkipped ? "not_applicable" : input.gitMode}`,
    `Git tracking strategy: ${input.gitTrackingStrategy}`,
    `Git tracking updated: ${input.gitTrackingUpdated ? "yes" : "no"}`
  ];

  if (input.gitQuestionSkipped) {
    lines.push("Git tracking question: skipped because selected root is not a Git repository.");
    lines.push("To configure tracking/ignoring later, initialize Git and run Install or Repair again.");
    return lines;
  }

  if (input.gitMode !== "ignore") {
    return lines;
  }

  if (input.gitTrackingStrategy === "git_info_exclude") {
    lines.push("Ignore behavior: managed paths were added to .git/info/exclude (repository-local metadata).");
    lines.push("How to exit ignore mode: run Install or Repair and choose 'Track in Git'.");
    return lines;
  }

  lines.push("Ignore behavior: skipped because selected root is not a Git repository.");
  lines.push("How to exit ignore mode: initialize Git first, then run Install or Repair and choose 'Track in Git'.");
  return lines;
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
      if (isWorkspaceSelectionCancelled()) {
        traceLogger.log("warning", "operation_blocked", {
          reason: "target_scope_cancelled"
        });
        void vscode.window.showInformationMessage("Install canceled at Installation Scope.");
        return;
      }

      traceLogger.log("warning", "operation_blocked", {
        reason: "no_workspace_folder"
      });
      void vscode.window.showWarningMessage("No workspace folder is available for install operation.");
      return;
    }

    traceLogger.log("debug", "target_resolved", {
      target_root: target.uri.fsPath
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
      void vscode.window.showInformationMessage("Install canceled at Project Profile.");
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

    const gitRepositoryAvailable = await hasGitRepository(target.uri.fsPath);
    const gitTrackingQuestionSkipped = !gitRepositoryAvailable;
    let gitTrackingSelection: OperationalSelections;

    if (gitRepositoryAvailable) {
      const selection = await askGitTrackingSelectionAtFinalStep();
      if (!selection) {
        traceLogger.log("warning", "operation_blocked", {
          reason: "git_tracking_selection_cancelled"
        });
        void vscode.window.showInformationMessage("Install canceled at Review & Apply (Git Tracking).");
        return;
      }

      gitTrackingSelection = selection;
    } else {
      gitTrackingSelection = { gitMode: "track" };
      traceLogger.log("debug", "git_tracking_question_skipped", {
        reason: "no_git_repository"
      });
    }

    traceLogger.log("debug", "git_tracking_selected", {
      git_mode: gitTrackingSelection.gitMode
    });

    const topicPreview = selectionPlan.selected_topics.slice(0, 10).map((topic) => topic.file_id);

    const acknowledged = await askPreInstallAcknowledgement({
      targetRootPath: target.uri.fsPath,
      selectedProfile: resolvedProfile.profile_id,
      gitModeSummary: gitTrackingQuestionSkipped ? "not_applicable (no Git repository)" : gitTrackingSelection.gitMode,
      selectedTopicCount: selectionPlan.selected_topics.length,
      previewTopicIds: topicPreview
    });

    if (!acknowledged) {
      traceLogger.log("warning", "operation_blocked", {
        reason: "pre_install_acknowledgement_declined"
      });
      void vscode.window.showInformationMessage("Install canceled at Review & Apply.");
      return;
    }

    const extensionVersion =
      typeof context.extension.packageJSON?.version === "string"
        ? context.extension.packageJSON.version
        : "0.0.0";
    const repositoryUrl = resolveRepositoryUrl(context.extension.packageJSON);

    const updateConsentResult = await requireUpdateConsentIfNeeded(
      {
        command: "install",
        targetRootPath: target.uri.fsPath,
        bundleId: resolvedProfile.profile_id,
        bundleVersion: String(questionnaire.flow.version),
        extensionVersion,
        repositoryUrl
      },
      traceLogger
    );

    if (updateConsentResult.blocked) {
      void vscode.window.showInformationMessage("Install canceled at Update Review.");
      return;
    }

    const gitTrackingResult = await applyGitTrackingMode(
      {
        targetRootPath: target.uri.fsPath,
        mode: gitTrackingSelection.gitMode
      },
      traceLogger
    );

    if (gitTrackingResult.strategy === "no_git_repository") {
      void vscode.window.showWarningMessage(
        "Selected workspace root is not a Git repository. Git tracking preference was skipped."
      );
    }

    const installResult = await applyManagedInstall(
      {
        extensionPath: context.extensionPath,
        targetRootPath: target.uri.fsPath,
        bundleId: resolvedProfile.profile_id,
        bundleVersion: String(questionnaire.flow.version),
        extensionVersion,
        selectedTopics: selectionPlan.selected_topics
      },
      traceLogger
    );

    const summary = [
      "Install foundation step completed.",
      `Target root: ${target.uri.fsPath}`,
      `Update review: ${updateConsentResult.updateAvailable ? "required and approved" : "not required"}`,
      ...buildGitTrackingSummaryLines({
        gitMode: gitTrackingSelection.gitMode,
        gitTrackingStrategy: gitTrackingResult.strategy,
        gitTrackingUpdated: gitTrackingResult.updated,
        gitQuestionSkipped: gitTrackingQuestionSkipped
      }),
      `Selected profile (Project Profile): ${resolvedProfile.profile_id}`,
      `Selected topics (resolver): ${selectionPlan.selected_topics.length}`,
      `Applied files: ${installResult.appliedFiles.length}`,
      `Skipped files: ${installResult.skippedFiles.length}`,
      `Removed stale managed files: ${installResult.removedStaleFiles.length}`,
      `Managed state: ${installResult.statePath}`,
      `Operation log: ${traceLogger.logFilePath}`
    ].join("\n");

    void vscode.window.showInformationMessage(summary, { modal: false });
    traceLogger.log("debug", "success_notification_shown", {
      target_profile: resolvedProfile.profile_id,
      selected_topic_count: selectionPlan.selected_topics.length,
      git_tracking_strategy: gitTrackingResult.strategy,
      applied_count: installResult.appliedFiles.length,
      skipped_count: installResult.skippedFiles.length,
      removed_stale_count: installResult.removedStaleFiles.length
    });

    const postInstallPanelOpened = await openPostInstallGuidancePage({
      targetRootPath: target.uri.fsPath,
      selectedProfile: resolvedProfile.profile_id,
      logFilePath: traceLogger.logFilePath,
      managedStatePath: installResult.statePath,
      gitMode: gitTrackingSelection.gitMode,
      gitTrackingStrategy: gitTrackingResult.strategy,
      gitTrackingUpdated: gitTrackingResult.updated,
      appliedCount: installResult.appliedFiles.length,
      skippedCount: installResult.skippedFiles.length,
      removedStaleCount: installResult.removedStaleFiles.length
    });

    traceLogger.log("debug", postInstallPanelOpened ? "post_install_page_opened" : "post_install_page_fallback", {
      target_profile: resolvedProfile.profile_id
    });

    traceLogger.log("debug", "operation_completed", {
      result_code: installResult.appliedFiles.length > 0 ? "applied" : "completed_with_skips",
      target_profile: resolvedProfile.profile_id
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
