import * as vscode from "vscode";

import { OperationalSelections } from "../contracts/questionnaire";
import { applyGitTrackingMode, hasGitRepository } from "../services/gitTrackingService";
import { applyManagedInstall } from "../services/managedInstallService";
import { OperationTraceLogger } from "../services/operationTraceLogger";
import { OutputLogger } from "../services/outputLogger";
import { openPostInstallGuidancePage } from "../services/postInstallGuidancePage";
import { requirePreInstallTransparencyAcknowledgement } from "../services/preInstallTransparencyService";
import {
  buildProjectOperationLogPath,
  mirrorOperationLogToProject
} from "../services/projectOperationLogService";
import { resolveProfileFromHints } from "../services/profileAssetService";
import {
  QuestionnaireCatalogEntry,
  loadQuestionnaireAssets,
  loadQuestionnaireCatalog
} from "../services/questionnaireAssetService";
import { runDynamicQuestionFlow } from "../services/questionnaireFlowRunner";
import {
  RootAgentsPermission,
  applyRootAgentsIntegration,
  inspectRootAgentsIntegration
} from "../services/rootAgentsIntegrationService";
import { resolveSelectionPlan } from "../services/selectionResolver";
import { requireUpdateConsentIfNeeded } from "../services/updateConsentService";
import { detectWorkspaceSignals } from "../services/workspaceSignalDetector";
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
      title: "Git Tracking Preference",
      placeHolder: "Should extension-managed onboarding files be tracked in Git?",
      ignoreFocusOut: true
    }
  );

  if (!gitMode) {
    return undefined;
  }

  return { gitMode: gitMode.value };
}

async function askRootAgentsEditPermission(): Promise<RootAgentsPermission | undefined> {
  const selection = await vscode.window.showQuickPick(
    [
      {
        label: "Yes, update root AGENTS.md",
        description: "Add a pointer to .codex-onboarding/INDEX.md automatically.",
        value: "allow_edit" as const
      },
      {
        label: "No, keep root AGENTS.md unchanged",
        description: "I will paste the pointer snippet manually from the post-install page.",
        value: "deny_edit" as const
      }
    ],
    {
      title: "Root AGENTS.md Permission",
      placeHolder:
        "Allow Codex Onboarding to edit root AGENTS.md and add a pointer to .codex-onboarding/INDEX.md?",
      ignoreFocusOut: true
    }
  );

  if (!selection) {
    return undefined;
  }

  return selection.value;
}

function toFamilyDisplayName(family: string): string {
  return family
    .split("-")
    .map((part) => (part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

type QuestionnaireFamilyResolution =
  | { status: "none" }
  | { status: "selected"; family: string }
  | { status: "cancelled" };

async function resolveQuestionnaireFamily(
  extensionPath: string,
  traceLogger: OperationTraceLogger
): Promise<QuestionnaireFamilyResolution> {
  const catalog = await loadQuestionnaireCatalog(extensionPath);
  traceLogger.log("debug", "dynamic_catalog_loaded", {
    catalog_version: catalog.version,
    catalog_family_count: catalog.families.length,
    catalog_index_path: catalog.indexPath
  });

  if (catalog.families.length === 0) {
    traceLogger.log("debug", "dynamic_catalog_skipped", {
      reason: "no_catalog_families_configured"
    });
    return { status: "none" };
  }

  if (catalog.families.length === 1) {
    const only = catalog.families[0]!;
    traceLogger.log("debug", "dynamic_catalog_family_resolved", {
      selected_family: only.family,
      selection_mode: "auto_single_family"
    });
    return {
      status: "selected",
      family: only.family
    };
  }

  const pick = await vscode.window.showQuickPick(
    catalog.families.map((entry: QuestionnaireCatalogEntry) => ({
      label: toFamilyDisplayName(entry.family),
      description: `Family key: ${entry.family}`,
      entry
    })),
    {
      title: "Project Technology Family",
      placeHolder: "Select the technology family for this workspace.",
      ignoreFocusOut: true
    }
  );

  if (!pick) {
    traceLogger.log("warning", "operation_blocked", {
      reason: "catalog_family_selection_cancelled"
    });
    return { status: "cancelled" };
  }

  traceLogger.log("debug", "dynamic_catalog_family_resolved", {
    selected_family: pick.entry.family,
    selection_mode: "quick_pick"
  });
  return {
    status: "selected",
    family: pick.entry.family
  };
}

function buildGitTrackingSummaryLines(input: {
  gitMode: "track" | "ignore";
  gitTrackingStrategy: "git_info_exclude" | "no_git_repository";
  gitTrackingUpdated: boolean;
  gitQuestionSkipped: boolean;
}): string[] {
  const lines = [
    `Git mode: ${input.gitQuestionSkipped ? "not_applicable" : input.gitMode}`,
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
  let targetRootPath: string | undefined;
  let projectLogPath: string | undefined;
  let shouldMirrorProjectLog = false;

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
    targetRootPath = target.uri.fsPath;

    const familyResolution = await resolveQuestionnaireFamily(context.extensionPath, traceLogger);
    if (familyResolution.status === "cancelled") {
      void vscode.window.showInformationMessage("Install canceled at Project Technology Family.");
      return;
    }

    const gitRepositoryAvailable = await hasGitRepository(target.uri.fsPath);
    const gitTrackingQuestionSkipped = !gitRepositoryAvailable;
    let selectedProfileId = "core-only";
    let bundleId = "core-only";
    let bundleVersion = "0";
    let selectionPlan = {
      profile_id: "core-only",
      capability_tags: [] as string[],
      selected_topics: [] as Array<{
        file_id: string;
        path: string;
        category: string;
        required: boolean;
        reasons: string[];
      }>
    };

    if (familyResolution.status === "selected") {
      const family = familyResolution.family;
      const workspaceSignals = await detectWorkspaceSignals(target.uri.fsPath);

      traceLogger.log("debug", "workspace_signals_detected", {
        signal_count: workspaceSignals.signals.length,
        signal_keys: workspaceSignals.signals.join(",")
      });

      const questionnaire = await loadQuestionnaireAssets(context.extensionPath, family);

      traceLogger.log("debug", "dynamic_question_flow_loaded", {
        family: questionnaire.family,
        index_path: questionnaire.indexPath,
        flow_path: questionnaire.flowPath
      });

      const profileSelectionAnswers = await runDynamicQuestionFlow(
        questionnaire.flow,
        traceLogger,
        operationId,
        {
          env: {
            git_available: gitRepositoryAvailable
          },
          detect: workspaceSignals.asFacts
        }
      );
      if (!profileSelectionAnswers) {
        traceLogger.log("warning", "operation_blocked", {
          reason: "profile_selection_questions_cancelled"
        });
        void vscode.window.showInformationMessage("Install canceled at Project Profile.");
        return;
      }

      const resolvedProfile = await resolveProfileFromHints(
        context.extensionPath,
        family,
        profileSelectionAnswers.profile_hints
      );

      selectionPlan = await resolveSelectionPlan(
        {
          extensionPath: context.extensionPath,
          family,
          profileId: resolvedProfile.profile_id,
          baselineTopicIds: resolvedProfile.baseline_topics,
          defaultCapabilities: resolvedProfile.default_capabilities,
          questionAnswers: profileSelectionAnswers.answers,
          wizardCapabilityTags: profileSelectionAnswers.capability_tags,
          wizardTopicTags: profileSelectionAnswers.topic_tags
        },
        traceLogger
      );

      selectedProfileId = resolvedProfile.profile_id;
      bundleId = resolvedProfile.profile_id;
      bundleVersion = String(questionnaire.flow.version);
    }

    const repositoryUrl = resolveRepositoryUrl(context.extension.packageJSON);
    const transparencyResult = await requirePreInstallTransparencyAcknowledgement(
      {
        command: "install",
        targetRootPath: target.uri.fsPath,
        repositoryUrl,
        selectedTopics: selectionPlan.selected_topics.map((topic) => ({
          fileId: topic.file_id,
          category: topic.category,
          reasons: topic.reasons
        }))
      },
      traceLogger
    );
    if (!transparencyResult.acknowledged) {
      void vscode.window.showInformationMessage(
        transparencyResult.openedSummary
          ? "Install paused. Review the consumer summary, then run Install again."
          : "Install canceled at Pre-Install Transparency Check."
      );
      return;
    }

    let gitTrackingSelection: OperationalSelections;

    if (gitRepositoryAvailable) {
      traceLogger.log("debug", "operational_question_asked", {
        question_id: "git_tracking_preference"
      });
      const selection = await askGitTrackingSelectionAtFinalStep();
      if (!selection) {
        traceLogger.log("warning", "operation_blocked", {
          reason: "git_tracking_selection_cancelled"
        });
        void vscode.window.showInformationMessage("Install canceled at Git Tracking Preference.");
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

    const rootAgentsInspection = await inspectRootAgentsIntegration(target.uri.fsPath);
    let rootAgentsPermission: RootAgentsPermission = "auto_create";

    if (rootAgentsInspection.exists) {
      traceLogger.log("debug", "operational_question_asked", {
        question_id: "root_agents_edit_permission"
      });
      const permission = await askRootAgentsEditPermission();
      if (!permission) {
        traceLogger.log("warning", "operation_blocked", {
          reason: "root_agents_permission_cancelled"
        });
        void vscode.window.showInformationMessage("Install canceled at Root AGENTS Permission.");
        return;
      }

      rootAgentsPermission = permission;
    }

    traceLogger.log("debug", "root_agents_permission_resolved", {
      root_agents_exists: rootAgentsInspection.exists,
      root_agents_permission: rootAgentsPermission
    });

    const extensionVersion =
      typeof context.extension.packageJSON?.version === "string"
        ? context.extension.packageJSON.version
        : "0.0.0";

    const updateConsentResult = await requireUpdateConsentIfNeeded(
      {
        command: "install",
        targetRootPath: target.uri.fsPath,
        bundleId,
        bundleVersion,
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
        bundleId,
        bundleVersion,
        extensionVersion,
        selectedTopics: selectionPlan.selected_topics
      },
      traceLogger
    );

    const rootAgentsResult = await applyRootAgentsIntegration(
      {
        inspection: rootAgentsInspection,
        permission: rootAgentsPermission
      },
      traceLogger
    );

    projectLogPath = buildProjectOperationLogPath(target.uri.fsPath, traceLogger.logFilePath);

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
      `Selected profile (Project Profile): ${selectedProfileId}`,
      `Selected topics (resolver): ${selectionPlan.selected_topics.length}`,
      `Applied files: ${installResult.appliedFiles.length}`,
      `Skipped files: ${installResult.skippedFiles.length}`,
      `Removed stale managed files: ${installResult.removedStaleFiles.length}`,
      `Root AGENTS integration: ${rootAgentsResult.status}`,
      `Managed state: ${installResult.statePath}`,
      ...(installResult.appliedArtifactsReportPath
        ? [`Applied artifacts report: ${installResult.appliedArtifactsReportPath}`]
        : []),
      `Project operation log: ${projectLogPath}`,
      `Operation log: ${traceLogger.logFilePath}`
    ].join("\n");

    shouldMirrorProjectLog = true;

    void vscode.window.showInformationMessage(summary, { modal: false });
    traceLogger.log("debug", "success_notification_shown", {
      target_profile: selectedProfileId,
      selected_topic_count: selectionPlan.selected_topics.length,
      git_tracking_strategy: gitTrackingResult.strategy,
      applied_count: installResult.appliedFiles.length,
      skipped_count: installResult.skippedFiles.length,
      removed_stale_count: installResult.removedStaleFiles.length
    });

    const postInstallPanelOpened = await openPostInstallGuidancePage({
      targetRootPath: target.uri.fsPath,
      selectedProfile: selectedProfileId,
      logFilePath: traceLogger.logFilePath,
      managedStatePath: installResult.statePath,
      gitMode: gitTrackingSelection.gitMode,
      gitTrackingStrategy: gitTrackingResult.strategy,
      gitTrackingUpdated: gitTrackingResult.updated,
      appliedCount: installResult.appliedFiles.length,
      skippedCount: installResult.skippedFiles.length,
      removedStaleCount: installResult.removedStaleFiles.length,
      extensionVersion,
      bundleId,
      bundleVersion,
      capabilityTags: selectionPlan.capability_tags,
      selectedTopics: selectionPlan.selected_topics.map((topic) => ({
        fileId: topic.file_id,
        category: topic.category,
        reasons: topic.reasons
      })),
      operationId,
      rootAgentsPath: rootAgentsResult.rootAgentsPath,
      rootAgentsStatus: rootAgentsResult.status,
      rootAgentsManualSnippet: rootAgentsResult.status === "skipped_user_declined"
        ? rootAgentsResult.manualSnippet
        : undefined
    });

    traceLogger.log("debug", postInstallPanelOpened ? "post_install_page_opened" : "post_install_page_fallback", {
      target_profile: selectedProfileId
    });

    traceLogger.log("debug", "operation_completed", {
      result_code: installResult.resultCode ?? (installResult.appliedFiles.length > 0 ? "applied" : "completed_with_skips"),
      target_profile: selectedProfileId
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

    if (traceLogger && shouldMirrorProjectLog && targetRootPath && projectLogPath) {
      try {
        await mirrorOperationLogToProject(targetRootPath, traceLogger.logFilePath, logger);
      } catch (error) {
        logger.log("warning", "operation_log_mirror_failed", {
          command: "install",
          target_root: targetRootPath,
          reason: error instanceof Error ? error.message : "unknown_error"
        });
      }
    }
  }
}
