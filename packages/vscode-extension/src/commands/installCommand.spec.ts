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
import {
  applyRootAgentsIntegration,
  inspectRootAgentsIntegration
} from "../services/rootAgentsIntegrationService";
import { resolveSelectionPlan } from "../services/selectionResolver";
import { openPostInstallGuidancePage } from "../services/postInstallGuidancePage";
import { requirePreInstallTransparencyAcknowledgement } from "../services/preInstallTransparencyService";
import { requireUpdateConsentIfNeeded } from "../services/updateConsentService";
import { resolveTargetWorkspaceFolder } from "../services/workspaceRootResolver";

const { createTraceLoggerMock } = vi.hoisted(() => ({
  createTraceLoggerMock: vi.fn()
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
});
