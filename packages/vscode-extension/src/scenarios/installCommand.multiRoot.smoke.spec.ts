import * as vscode from "vscode";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runInstall } from "../commands/installCommand";
import { applyGitTrackingMode, hasGitRepository } from "../services/gitTrackingService";
import { applyManagedInstall } from "../services/managedInstallService";
import { resolveProfileFromHints } from "../services/profileAssetService";
import {
  loadQuestionnaireAssets,
  loadQuestionnaireCatalog
} from "../services/questionnaireAssetService";
import { runDynamicQuestionFlow } from "../services/questionnaireFlowRunner";
import { resolveSelectionPlan } from "../services/selectionResolver";
import { openPostInstallGuidancePage } from "../services/postInstallGuidancePage";
import { requirePreInstallTransparencyAcknowledgement } from "../services/preInstallTransparencyService";
import {
  applyRootAgentsIntegration,
  inspectRootAgentsIntegration
} from "../services/rootAgentsIntegrationService";
import { requireUpdateConsentIfNeeded } from "../services/updateConsentService";

const { createTraceLoggerMock } = vi.hoisted(() => ({
  createTraceLoggerMock: vi.fn()
}));

vi.mock("../services/operationTraceLogger", () => ({
  OperationTraceLogger: {
    create: createTraceLoggerMock
  }
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

vi.mock("../services/updateConsentService", () => ({
  requireUpdateConsentIfNeeded: vi.fn()
}));

function buildFolder(name: string, fsPath: string): vscode.WorkspaceFolder {
  return {
    index: 0,
    name,
    uri: { fsPath } as vscode.Uri
  } as vscode.WorkspaceFolder;
}

describe("install command multi-root smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createTraceLoggerMock.mockResolvedValue({
      log: vi.fn(),
      flush: vi.fn(),
      logFilePath: "/tmp/storage/operation-logs/install-log.jsonl"
    });

    vi.mocked(loadQuestionnaireAssets).mockResolvedValue({
      family: "dotnet-csharp",
      indexPath: "index.yaml",
      flowPath: "flow.yaml",
      flow: {
        version: 3,
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
      statePath: "/workspace/app-b/.codex-onboarding/.managed/state.json",
      managedRootPath: "/workspace/app-b/.codex-onboarding/.managed",
      appliedFiles: [".codex-onboarding/AGENTS.md"],
      skippedFiles: [],
      recoveredTrackedFiles: [],
      removedStaleFiles: [],
      stateRewritten: true,
      resultCode: "applied"
    });

    vi.mocked(openPostInstallGuidancePage).mockResolvedValue(true);
    vi.mocked(requirePreInstallTransparencyAcknowledgement).mockResolvedValue({
      acknowledged: true,
      openedSummary: false
    });
    vi.mocked(requireUpdateConsentIfNeeded).mockResolvedValue({
      updateAvailable: false,
      blocked: false,
      reason: "no_managed_state"
    });
    vi.mocked(hasGitRepository).mockResolvedValue(true);
    vi.mocked(applyGitTrackingMode).mockResolvedValue({
      mode: "track",
      strategy: "git_info_exclude",
      updated: true,
      excludePath: "/workspace/app-b/.git/info/exclude"
    });
    vi.mocked(inspectRootAgentsIntegration).mockResolvedValue({
      exists: false,
      containsOnboardingReference: false,
      rootAgentsPath: "/workspace/app-b/AGENTS.md"
    });
    vi.mocked(applyRootAgentsIntegration).mockResolvedValue({
      status: "created",
      rootAgentsPath: "/workspace/app-b/AGENTS.md"
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (vscode.workspace as { workspaceFolders?: vscode.WorkspaceFolder[] }).workspaceFolders = undefined;
  });

  it("S-11: picks selected root in multi-root workspace and applies install there", async () => {
    const first = buildFolder("app-a", "/workspace/app-a");
    const second = buildFolder("app-b", "/workspace/app-b");

    (vscode.workspace as { workspaceFolders?: vscode.WorkspaceFolder[] }).workspaceFolders = [first, second];

    const quickPickSpy = vi.spyOn(vscode.window, "showQuickPick");
    quickPickSpy
      .mockResolvedValueOnce({
        label: second.name,
        description: second.uri.fsPath,
        folder: second
      } as never)
      .mockResolvedValueOnce({
        label: "Track managed files",
        value: "track"
      } as never);

    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

    const context = {
      extensionPath: "/tmp/ext",
      globalStorageUri: { fsPath: "/tmp/storage" },
      extension: {
        id: "publisher.extension",
        packageJSON: { version: "1.2.3" }
      }
    } as unknown as vscode.ExtensionContext;

    await runInstall(context, { log: vi.fn(), show: vi.fn() } as any);

    expect(quickPickSpy).toHaveBeenCalledTimes(2);
    expect(quickPickSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: "Installation Scope"
      })
    );

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRootPath: "/workspace/app-b",
        bundleId: "dotnet-csharp-web-api-simple"
      }),
      expect.any(Object)
    );
  });
});
