import * as vscode from "vscode";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runInstall } from "./installCommand";
import { applyGitTrackingMode, hasGitRepository } from "../services/gitTrackingService";
import { applyManagedInstall } from "../services/managedInstallService";
import { resolveProfileFromHints } from "../services/profileAssetService";
import {
  loadQuestionnaireAssets,
  loadQuestionnaireCatalog
} from "../services/questionnaireAssetService";
import { runDynamicQuestionFlow } from "../services/questionnaireFlowRunner";
import { mirrorOperationLogToProject } from "../services/projectOperationLogService";
import {
  applyRootAgentsIntegration,
  inspectRootAgentsIntegration
} from "../services/rootAgentsIntegrationService";
import { resolveSelectionPlan } from "../services/selectionResolver";
import { openPostInstallGuidancePage } from "../services/postInstallGuidancePage";
import { requirePreInstallTransparencyAcknowledgement } from "../services/preInstallTransparencyService";
import { requireUpdateConsentIfNeeded } from "../services/updateConsentService";
import { resolveTargetWorkspaceFolder } from "../services/workspaceRootResolver";

const { createTraceLoggerMock, mirrorOperationLogToProjectMock } = vi.hoisted(() => ({
  createTraceLoggerMock: vi.fn(),
  mirrorOperationLogToProjectMock: vi.fn()
}));

vi.mock("../services/operationTraceLogger", () => ({
  OperationTraceLogger: {
    create: createTraceLoggerMock
  }
}));

vi.mock("../services/workspaceRootResolver", () => ({
  resolveTargetWorkspaceFolder: vi.fn()
}));

vi.mock("../services/questionnaireAssetService", () => ({
  loadQuestionnaireCatalog: vi.fn(),
  loadQuestionnaireAssets: vi.fn()
}));

vi.mock("../services/questionnaireFlowRunner", () => ({
  runDynamicQuestionFlow: vi.fn()
}));

vi.mock("../services/profileAssetService", () => ({
  resolveProfileFromHints: vi.fn()
}));

vi.mock("../services/selectionResolver", () => ({
  resolveSelectionPlan: vi.fn()
}));

vi.mock("../services/managedInstallService", () => ({
  applyManagedInstall: vi.fn()
}));

vi.mock("../services/gitTrackingService", () => ({
  applyGitTrackingMode: vi.fn(),
  hasGitRepository: vi.fn()
}));

vi.mock("../services/updateConsentService", () => ({
  requireUpdateConsentIfNeeded: vi.fn()
}));

vi.mock("../services/postInstallGuidancePage", () => ({
  openPostInstallGuidancePage: vi.fn()
}));

vi.mock("../services/projectOperationLogService", () => ({
  buildProjectOperationLogPath: vi.fn((targetRootPath: string, sourceLogPath: string) =>
    `${targetRootPath}/.codex-onboarding/.managed/logs/${sourceLogPath.split("/").pop()}`
  ),
  mirrorOperationLogToProject: mirrorOperationLogToProjectMock
}));

vi.mock("../services/preInstallTransparencyService", () => ({
  requirePreInstallTransparencyAcknowledgement: vi.fn()
}));

vi.mock("../services/rootAgentsIntegrationService", () => ({
  inspectRootAgentsIntegration: vi.fn(),
  applyRootAgentsIntegration: vi.fn()
}));

function buildContext(): vscode.ExtensionContext {
  return {
    extensionPath: "/tmp/ext",
    globalStorageUri: { fsPath: "/tmp/storage" },
    extension: {
      id: "publisher.extension",
      packageJSON: { version: "1.2.3" }
    }
  } as unknown as vscode.ExtensionContext;
}

function buildContextWithRepositoryUrl(repositoryUrl: string): vscode.ExtensionContext {
  return {
    extensionPath: "/tmp/ext",
    globalStorageUri: { fsPath: "/tmp/storage" },
    extension: {
      id: "publisher.extension",
      packageJSON: {
        version: "1.2.3",
        repository: {
          type: "git",
          url: repositoryUrl
        }
      }
    }
  } as unknown as vscode.ExtensionContext;
}

function buildContextWithRepositoryString(repositoryUrl: string): vscode.ExtensionContext {
  return {
    extensionPath: "/tmp/ext",
    globalStorageUri: { fsPath: "/tmp/storage" },
    extension: {
      id: "publisher.extension",
      packageJSON: {
        version: "1.2.3",
        repository: repositoryUrl
      }
    }
  } as unknown as vscode.ExtensionContext;
}

function buildContextWithInvalidPackageJson(): vscode.ExtensionContext {
  return {
    extensionPath: "/tmp/ext",
    globalStorageUri: { fsPath: "/tmp/storage" },
    extension: {
      id: "publisher.extension",
      packageJSON: null
    }
  } as unknown as vscode.ExtensionContext;
}

function buildContextWithNonStringRepositoryUrl(): vscode.ExtensionContext {
  return {
    extensionPath: "/tmp/ext",
    globalStorageUri: { fsPath: "/tmp/storage" },
    extension: {
      id: "publisher.extension",
      packageJSON: {
        version: "1.2.3",
        repository: {
          type: "git",
          url: 12345
        }
      }
    }
  } as unknown as vscode.ExtensionContext;
}

describe("runInstall", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createTraceLoggerMock.mockResolvedValue({
      log: vi.fn(),
      flush: vi.fn(),
      logFilePath: "/tmp/storage/operation-logs/install-log.jsonl"
    });

    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: "/workspace/project" }
    } as unknown as vscode.WorkspaceFolder);

    vi.mocked(loadQuestionnaireAssets).mockResolvedValue({
      family: "dotnet-csharp",
      indexPath: "index.yaml",
      flowPath: "flow.yaml",
      flow: {
        version: 7,
        family: "dotnet-csharp",
        entrypoint: "root",
        nodes: []
      }
    });
    vi.mocked(loadQuestionnaireCatalog).mockResolvedValue({
      version: 1,
      indexPath: "index.yaml",
      families: [
        {
          family: "dotnet-csharp",
          installFlowRelativePath: "library/questionnaires/dotnet-csharp/install-flow.yaml"
        }
      ]
    });

    vi.mocked(runDynamicQuestionFlow).mockResolvedValue({
      answers: {
        root: ["backend"],
        backend_stack: ["dotnet_web_api"]
      },
      selected_paths: ["root:backend", "root:backend>backend_stack:dotnet_web_api"],
      capability_tags: ["tech.backend.dotnet.webapi"],
      profile_hints: ["dotnet-csharp-web-api-simple"],
      topic_tags: [],
      family_keys: [],
      why_selected: [],
      why_skipped: []
    });

    vi.mocked(resolveProfileFromHints).mockResolvedValue({
      version: 1,
      profile_id: "dotnet-csharp-web-api-simple",
      family: "dotnet-csharp",
      questionnaire_ref: "library/questionnaires/dotnet-csharp/install-flow.yaml",
      baseline_topics: ["base-topic"],
      default_capabilities: ["cap.base"]
    });

    vi.mocked(resolveSelectionPlan).mockResolvedValue({
      profile_id: "dotnet-csharp-web-api-simple",
      capability_tags: ["cap.base", "tech.backend.dotnet.webapi", "answer.backend_stack.dotnet_web_api"],
      selected_topics: [
        {
          file_id: "base-topic",
          path: "topics/cross-cutting/base-topic.md",
          category: "00-core",
          required: true,
          reasons: ["selected_by_profile_baseline"]
        }
      ]
    });

    vi.mocked(applyManagedInstall).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/workspace/project/.codex-onboarding/.managed",
      appliedFiles: [".codex-onboarding/AGENTS.md"],
      skippedFiles: [],
      recoveredTrackedFiles: [],
      removedStaleFiles: [],
      stateRewritten: true,
      resultCode: "applied"
    });
    vi.mocked(applyGitTrackingMode).mockResolvedValue({
      mode: "track",
      strategy: "git_info_exclude",
      updated: true,
      excludePath: "/workspace/project/.git/info/exclude"
    });
    vi.mocked(hasGitRepository).mockResolvedValue(true);
    vi.mocked(requireUpdateConsentIfNeeded).mockResolvedValue({
      updateAvailable: false,
      blocked: false,
      reason: "no_managed_state"
    });
    vi.mocked(requirePreInstallTransparencyAcknowledgement).mockResolvedValue({
      acknowledged: true,
      openedSummary: false
    });

    vi.mocked(inspectRootAgentsIntegration).mockResolvedValue({
      exists: false,
      containsOnboardingReference: false,
      rootAgentsPath: "/workspace/project/AGENTS.md"
    });
    vi.mocked(applyRootAgentsIntegration).mockResolvedValue({
      status: "created",
      rootAgentsPath: "/workspace/project/AGENTS.md"
    });

    vi.mocked(openPostInstallGuidancePage).mockResolvedValue(true);
    vi.mocked(mirrorOperationLogToProject).mockResolvedValue(
      "/workspace/project/.codex-onboarding/.managed/logs/install-log.jsonl"
    );
  });

  it("blocks when no workspace folder is available", async () => {
    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue(undefined);

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No workspace folder is available for install operation."
    );
    expect(applyManagedInstall).not.toHaveBeenCalled();
    expect(requireUpdateConsentIfNeeded).not.toHaveBeenCalled();
    expect(hasGitRepository).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "no_workspace_folder"
    });
    expect(trace.flush).toHaveBeenCalledTimes(1);
  });

  it("cancels at installation scope when workspace selection is dismissed", async () => {
    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue(undefined);
    (vscode.workspace as unknown as { workspaceFolders: vscode.WorkspaceFolder[] }).workspaceFolders = [
      { name: "project", uri: { fsPath: "/workspace/project" } } as unknown as vscode.WorkspaceFolder
    ];

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "Install canceled at Installation Scope."
    );

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "target_scope_cancelled"
    });

    (vscode.workspace as unknown as { workspaceFolders: vscode.WorkspaceFolder[] | undefined }).workspaceFolders =
      undefined;
  });

  it("completes install flow and opens post-install guidance page", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    const logger = { log: vi.fn(), show: vi.fn() };
    await runInstall(buildContext(), logger as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRootPath: "/workspace/project",
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "7",
        extensionVersion: "1.2.3"
      }),
      expect.any(Object)
    );
    expect(requireUpdateConsentIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "install",
        targetRootPath: "/workspace/project",
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "7",
        extensionVersion: "1.2.3"
      }),
      expect.any(Object)
    );
    expect(applyGitTrackingMode).toHaveBeenCalledWith(
      {
        targetRootPath: "/workspace/project",
        mode: "track"
      },
      expect.any(Object)
    );

    expect(openPostInstallGuidancePage).toHaveBeenCalledWith({
      targetRootPath: "/workspace/project",
      selectedProfile: "dotnet-csharp-web-api-simple",
      logFilePath: "/tmp/storage/operation-logs/install-log.jsonl",
      managedStatePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      gitMode: "track",
      gitTrackingStrategy: "git_info_exclude",
      gitTrackingUpdated: true,
      appliedCount: 1,
      skippedCount: 0,
      removedStaleCount: 0,
      extensionVersion: "1.2.3",
      bundleId: "dotnet-csharp-web-api-simple",
      bundleVersion: "7",
      capabilityTags: ["cap.base", "tech.backend.dotnet.webapi", "answer.backend_stack.dotnet_web_api"],
      selectedTopics: [
        {
          fileId: "base-topic",
          category: "00-core",
          reasons: ["selected_by_profile_baseline"]
        }
      ],
      operationId: expect.stringMatching(/^install-\d+$/),
      rootAgentsPath: "/workspace/project/AGENTS.md",
      rootAgentsStatus: "created",
      rootAgentsManualSnippet: undefined
    });
    expect(logger.show).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith(
      "debug",
      "operation_completed",
      expect.objectContaining({ result_code: "applied" })
    );
  });

  it("shows error message when install fails", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    vi.mocked(applyManagedInstall).mockRejectedValue(new Error("boom"));
    const logger = { log: vi.fn(), show: vi.fn() };

    await runInstall(buildContext(), logger as any);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Install failed: boom");
    expect(logger.show).toHaveBeenCalledTimes(1);

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({ result_code: "failed", reason: "boom" })
    );
    expect(trace.flush).toHaveBeenCalledTimes(1);
  });

  it("logs unknown error reason when install fails with non-Error throw", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    vi.mocked(applyManagedInstall).mockRejectedValue("boom-string");
    const logger = { log: vi.fn(), show: vi.fn() };

    await runInstall(buildContext(), logger as any);

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({ result_code: "failed", reason: "unknown_error" })
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Install failed: unknown error");
  });

  it("blocks when git tracking selection is cancelled", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();
    expect(applyGitTrackingMode).not.toHaveBeenCalled();
    expect(requireUpdateConsentIfNeeded).not.toHaveBeenCalled();
    expect(hasGitRepository).toHaveBeenCalledTimes(1);

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "git_tracking_selection_cancelled"
    });
  });

  it("blocks when pre-install transparency acknowledgement is declined", async () => {
    vi.mocked(requirePreInstallTransparencyAcknowledgement).mockResolvedValueOnce({
      acknowledged: false,
      openedSummary: false
    });

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();
    expect(applyGitTrackingMode).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "Install canceled at Pre-Install Transparency Check."
    );
  });

  it("shows paused message when transparency summary was opened but not acknowledged", async () => {
    vi.mocked(requirePreInstallTransparencyAcknowledgement).mockResolvedValueOnce({
      acknowledged: false,
      openedSummary: true
    });

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "Install paused. Review the consumer summary, then run Install again."
    );
  });

  it("blocks when profile selection questions are cancelled", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    vi.mocked(runDynamicQuestionFlow).mockResolvedValue(undefined);
    const logger = { log: vi.fn(), show: vi.fn() };

    await runInstall(buildContext(), logger as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();
    expect(applyGitTrackingMode).not.toHaveBeenCalled();
    expect(requireUpdateConsentIfNeeded).not.toHaveBeenCalled();
    expect(hasGitRepository).toHaveBeenCalledTimes(1);
    expect(inspectRootAgentsIntegration).not.toHaveBeenCalled();
    expect(applyRootAgentsIntegration).not.toHaveBeenCalled();
    expect(logger.show).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "profile_selection_questions_cancelled"
    });
  });

  it("blocks when project technology family selection is cancelled", async () => {
    vi.mocked(loadQuestionnaireCatalog).mockResolvedValue({
      version: 1,
      indexPath: "index.yaml",
      families: [
        {
          family: "dotnet-csharp",
          installFlowRelativePath: "library/questionnaires/dotnet-csharp/install-flow.yaml"
        },
        {
          family: "python",
          installFlowRelativePath: "library/questionnaires/python/install-flow.yaml"
        }
      ]
    });
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(loadQuestionnaireAssets).not.toHaveBeenCalled();
    expect(runDynamicQuestionFlow).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "Install canceled at Project Technology Family."
    );
  });

  it("renders multi-part family labels even when family key contains empty segments", async () => {
    vi.mocked(loadQuestionnaireCatalog).mockResolvedValue({
      version: 1,
      indexPath: "index.yaml",
      families: [
        {
          family: "dotnet--csharp",
          installFlowRelativePath: "library/questionnaires/dotnet-csharp/install-flow.yaml"
        },
        {
          family: "python",
          installFlowRelativePath: "library/questionnaires/python/install-flow.yaml"
        }
      ]
    });
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ label: "Dotnet  Csharp" })]),
      expect.any(Object)
    );
  });

  it("resolves selected family from multi-family catalog quick pick", async () => {
    vi.mocked(loadQuestionnaireCatalog).mockResolvedValue({
      version: 1,
      indexPath: "index.yaml",
      families: [
        {
          family: "dotnet-csharp",
          installFlowRelativePath: "library/questionnaires/dotnet-csharp/install-flow.yaml"
        },
        {
          family: "python",
          installFlowRelativePath: "library/questionnaires/python/install-flow.yaml"
        }
      ]
    });
    vi.spyOn(vscode.window, "showQuickPick")
      .mockResolvedValueOnce({
        label: "Python",
        entry: {
          family: "python",
          installFlowRelativePath: "library/questionnaires/python/install-flow.yaml"
        }
      } as any)
      .mockResolvedValueOnce({
        label: "Track managed files",
        value: "track"
      } as any);

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(loadQuestionnaireAssets).toHaveBeenCalledWith("/tmp/ext", "python");
    expect(resolveSelectionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        family: "python"
      }),
      expect.any(Object)
    );
  });

  it("skips technology question flow when questionnaire catalog has no families", async () => {
    vi.mocked(loadQuestionnaireCatalog).mockResolvedValue({
      version: 1,
      indexPath: "index.yaml",
      families: []
    });
    vi.mocked(hasGitRepository).mockResolvedValue(false);

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(loadQuestionnaireAssets).not.toHaveBeenCalled();
    expect(runDynamicQuestionFlow).not.toHaveBeenCalled();
    expect(resolveProfileFromHints).not.toHaveBeenCalled();
    expect(resolveSelectionPlan).not.toHaveBeenCalled();
    expect(requireUpdateConsentIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        bundleId: "core-only",
        bundleVersion: "0"
      }),
      expect.any(Object)
    );
    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        bundleId: "core-only",
        bundleVersion: "0",
        selectedTopics: []
      }),
      expect.any(Object)
    );
  });

  it("falls back to output logger when trace logger cannot be created", async () => {
    createTraceLoggerMock.mockRejectedValue("trace-create-failed");
    const logger = { log: vi.fn(), show: vi.fn() };

    await runInstall(buildContext(), logger as any);

    expect(logger.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({
        command: "install",
        result_code: "failed",
        reason: "unknown_error"
      })
    );

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Install failed: unknown error");
    expect(logger.show).toHaveBeenCalledTimes(1);
  });

  it("falls back to output logger with explicit message when trace logger creation throws Error", async () => {
    createTraceLoggerMock.mockRejectedValue(new Error("trace init failed"));
    const logger = { log: vi.fn(), show: vi.fn() };

    await runInstall(buildContext(), logger as any);

    expect(logger.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({
        command: "install",
        result_code: "failed",
        reason: "trace init failed"
      })
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Install failed: trace init failed");
  });

  it("continues successfully when post-install panel falls back", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    vi.mocked(openPostInstallGuidancePage).mockResolvedValue(false);

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledTimes(1);

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("debug", "post_install_page_fallback", {
      target_profile: "dotnet-csharp-web-api-simple"
    });
    expect(trace.log).toHaveBeenCalledWith(
      "debug",
      "operation_completed",
      expect.objectContaining({ result_code: "applied" })
    );
  });

  it("logs mirror warning when project log mirroring fails", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);
    const logger = { log: vi.fn(), show: vi.fn() };
    vi.mocked(mirrorOperationLogToProject).mockRejectedValue(new Error("mirror failed"));

    await runInstall(buildContext(), logger as any);

    expect(logger.log).toHaveBeenCalledWith(
      "warning",
      "operation_log_mirror_failed",
      expect.objectContaining({
        command: "install",
        target_root: "/workspace/project",
        reason: "mirror failed"
      })
    );
  });

  it("logs mirror warning with unknown reason when mirroring fails with non-Error", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);
    const logger = { log: vi.fn(), show: vi.fn() };
    vi.mocked(mirrorOperationLogToProject).mockRejectedValue("mirror boom");

    await runInstall(buildContext(), logger as any);

    expect(logger.log).toHaveBeenCalledWith(
      "warning",
      "operation_log_mirror_failed",
      expect.objectContaining({
        command: "install",
        target_root: "/workspace/project",
        reason: "unknown_error"
      })
    );
  });

  it("falls back to completed_with_skips result code when service result code is absent", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);
    vi.mocked(applyManagedInstall).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/workspace/project/.codex-onboarding/.managed",
      appliedFiles: [],
      skippedFiles: [".codex-onboarding/core/topics/example.md"],
      recoveredTrackedFiles: [],
      removedStaleFiles: [],
      stateRewritten: true,
      resultCode: undefined as unknown as "applied"
    });

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith(
      "debug",
      "operation_completed",
      expect.objectContaining({ result_code: "completed_with_skips" })
    );
  });

  it("blocks when update review is declined", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    vi.mocked(requireUpdateConsentIfNeeded).mockResolvedValue({
      updateAvailable: true,
      blocked: true,
      reason: "update_consent_declined",
      releaseNotesUrl: "https://example.com/release",
      changelogUrl: "https://example.com/changelog"
    });

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyGitTrackingMode).not.toHaveBeenCalled();
    expect(applyManagedInstall).not.toHaveBeenCalled();
    expect(openPostInstallGuidancePage).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.flush).toHaveBeenCalledTimes(1);
  });

  it("skips git tracking question when root has no git repository", async () => {
    vi.mocked(hasGitRepository).mockResolvedValue(false);

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(0);
    expect(applyGitTrackingMode).toHaveBeenCalledWith(
      {
        targetRootPath: "/workspace/project",
        mode: "track"
      },
      expect.any(Object)
    );
    expect(inspectRootAgentsIntegration).toHaveBeenCalledWith("/workspace/project");
    expect(applyRootAgentsIntegration).toHaveBeenCalledWith(
      {
        inspection: expect.objectContaining({
          rootAgentsPath: "/workspace/project/AGENTS.md"
        }),
        permission: "auto_create"
      },
      expect.any(Object)
    );
  });

  it("includes ignore mechanism and opt-out guidance in final install summary", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Ignore in Local Git Metadata",
      value: "ignore"
    } as any);

    vi.mocked(applyGitTrackingMode).mockResolvedValue({
      mode: "ignore",
      strategy: "git_info_exclude",
      updated: true,
      excludePath: "/workspace/project/.git/info/exclude"
    });

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(".git/info/exclude"),
      { modal: false }
    );
    expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("How to exit ignore mode"),
      { modal: false }
    );
  });

  it("warns when git tracking apply reports non-git root after ignore selection", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Ignore in Local Git Metadata",
      value: "ignore"
    } as any);

    vi.mocked(applyGitTrackingMode).mockResolvedValue({
      mode: "ignore",
      strategy: "no_git_repository",
      updated: false
    });

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "Selected workspace root is not a Git repository. Git tracking preference was skipped."
    );
    expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("Ignore behavior: skipped because selected root is not a Git repository."),
      { modal: false }
    );
  });

  it("blocks when root AGENTS permission is cancelled", async () => {
    vi.mocked(inspectRootAgentsIntegration).mockResolvedValue({
      exists: true,
      containsOnboardingReference: false,
      rootAgentsPath: "/workspace/project/AGENTS.md"
    });

    vi.spyOn(vscode.window, "showQuickPick")
      .mockResolvedValueOnce({
        label: "Track managed files",
        value: "track"
      } as any)
      .mockResolvedValueOnce(undefined);

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();
    expect(applyRootAgentsIntegration).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "Install canceled at Root AGENTS Permission."
    );
  });

  it("provides manual root AGENTS snippet when user declines edit", async () => {
    vi.mocked(inspectRootAgentsIntegration).mockResolvedValue({
      exists: true,
      containsOnboardingReference: false,
      rootAgentsPath: "/workspace/project/AGENTS.md"
    });

    vi.mocked(applyRootAgentsIntegration).mockResolvedValue({
      status: "skipped_user_declined",
      rootAgentsPath: "/workspace/project/AGENTS.md",
      manualSnippet: "manual snippet"
    });

    vi.spyOn(vscode.window, "showQuickPick")
      .mockResolvedValueOnce({
        label: "Track managed files",
        value: "track"
      } as any)
      .mockResolvedValueOnce({
        label: "No, keep root AGENTS.md unchanged",
        value: "deny_edit"
      } as any);

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyRootAgentsIntegration).toHaveBeenCalledWith(
      {
        inspection: expect.objectContaining({
          rootAgentsPath: "/workspace/project/AGENTS.md"
        }),
        permission: "deny_edit"
      },
      expect.any(Object)
    );

    expect(openPostInstallGuidancePage).toHaveBeenCalledWith(
      expect.objectContaining({
        rootAgentsPath: "/workspace/project/AGENTS.md",
        rootAgentsStatus: "skipped_user_declined",
        rootAgentsManualSnippet: "manual snippet"
      })
    );
  });

  it("passes repository url object field into transparency and update checks", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    await runInstall(
      buildContextWithRepositoryUrl("https://example.com/repo.git"),
      { log: vi.fn(), show: vi.fn() } as any
    );

    expect(requirePreInstallTransparencyAcknowledgement).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryUrl: "https://example.com/repo.git"
      }),
      expect.any(Object)
    );
    expect(requireUpdateConsentIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryUrl: "https://example.com/repo.git"
      }),
      expect.any(Object)
    );
  });

  it("passes repository url when package repository field is string", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    await runInstall(
      buildContextWithRepositoryString("https://example.com/from-string.git"),
      { log: vi.fn(), show: vi.fn() } as any
    );

    expect(requirePreInstallTransparencyAcknowledgement).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryUrl: "https://example.com/from-string.git"
      }),
      expect.any(Object)
    );
  });

  it("keeps repository url undefined when package json shape is invalid", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    await runInstall(buildContextWithInvalidPackageJson(), { log: vi.fn(), show: vi.fn() } as any);

    expect(requirePreInstallTransparencyAcknowledgement).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryUrl: undefined
      }),
      expect.any(Object)
    );
  });

  it("keeps repository url undefined when repository.url is not a string", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    await runInstall(buildContextWithNonStringRepositoryUrl(), { log: vi.fn(), show: vi.fn() } as any);

    expect(requirePreInstallTransparencyAcknowledgement).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryUrl: undefined
      }),
      expect.any(Object)
    );
  });

  it("shows update-approved summary and includes applied artifacts report path when present", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);
    vi.mocked(requireUpdateConsentIfNeeded).mockResolvedValue({
      updateAvailable: true,
      blocked: false,
      reason: "update_review_approved",
      releaseNotesUrl: "https://example.com/release",
      changelogUrl: "https://example.com/changelog"
    });
    vi.mocked(applyManagedInstall).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/workspace/project/.codex-onboarding/.managed",
      appliedArtifactsReportPath: "/workspace/project/.codex-onboarding/.managed/applied-artifacts.md",
      appliedFiles: [".codex-onboarding/AGENTS.md"],
      skippedFiles: [],
      recoveredTrackedFiles: [],
      removedStaleFiles: [],
      stateRewritten: true,
      resultCode: "applied"
    });

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("Update review: required and approved"),
      { modal: false }
    );
    expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("Applied artifacts report: /workspace/project/.codex-onboarding/.managed/applied-artifacts.md"),
      { modal: false }
    );
  });

  it("falls back to applied result code when resultCode is absent but applied files exist", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);
    vi.mocked(applyManagedInstall).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/workspace/project/.codex-onboarding/.managed",
      appliedFiles: [".codex-onboarding/AGENTS.md"],
      skippedFiles: [],
      recoveredTrackedFiles: [],
      removedStaleFiles: [],
      stateRewritten: true,
      resultCode: undefined as unknown as "applied"
    });

    await runInstall(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith(
      "debug",
      "operation_completed",
      expect.objectContaining({ result_code: "applied" })
    );
  });
});
