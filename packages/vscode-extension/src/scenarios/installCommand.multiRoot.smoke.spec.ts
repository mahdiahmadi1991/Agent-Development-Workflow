import * as vscode from "vscode";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runInstall } from "../commands/installCommand";
import { applyManagedInstall } from "../services/managedInstallService";
import { loadResolvedProfile } from "../services/profileAssetService";
import { loadQuestionnaireAssets } from "../services/questionnaireAssetService";
import { runDynamicQuestionFlow } from "../services/questionnaireFlowRunner";
import { resolveSelectionPlan } from "../services/selectionResolver";
import { openPostInstallGuidancePage } from "../services/postInstallGuidancePage";

const { createTraceLoggerMock } = vi.hoisted(() => ({
  createTraceLoggerMock: vi.fn()
}));

vi.mock("../services/operationTraceLogger", () => ({
  OperationTraceLogger: {
    create: createTraceLoggerMock
  }
}));

vi.mock("../services/questionnaireAssetService", () => ({
  loadQuestionnaireAssets: vi.fn()
}));

vi.mock("../services/questionnaireFlowRunner", () => ({
  runDynamicQuestionFlow: vi.fn()
}));

vi.mock("../services/profileAssetService", () => ({
  loadResolvedProfile: vi.fn()
}));

vi.mock("../services/selectionResolver", () => ({
  resolveSelectionPlan: vi.fn()
}));

vi.mock("../services/managedInstallService", () => ({
  applyManagedInstall: vi.fn()
}));

vi.mock("../services/postInstallGuidancePage", () => ({
  openPostInstallGuidancePage: vi.fn()
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

    vi.mocked(runDynamicQuestionFlow).mockResolvedValue({
      answers: {
        root: "web_api_simple"
      }
    });

    vi.mocked(loadResolvedProfile).mockResolvedValue({
      version: 1,
      profile_id: "dotnet-csharp-web-api-simple",
      family: "dotnet-csharp",
      questionnaire_ref: "library/questionnaires/dotnet-csharp/install-flow.yaml",
      baseline_topics: ["base-topic"],
      default_capabilities: ["cap.base"]
    });

    vi.mocked(resolveSelectionPlan).mockResolvedValue({
      profile_id: "dotnet-csharp-web-api-simple",
      capability_tags: ["cap.base", "answer.root.web_api_simple"],
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
      appliedFiles: [".codex-onboarding/core/AGENT-ONBOARDING.md"],
      skippedFiles: [],
      recoveredTrackedFiles: [],
      removedStaleFiles: []
    });

    vi.mocked(openPostInstallGuidancePage).mockResolvedValue();
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

    vi.spyOn(vscode.window, "showInformationMessage")
      .mockResolvedValueOnce("Apply" as never)
      .mockResolvedValue(undefined);
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

    await runInstall(context, { log: vi.fn() } as any);

    expect(quickPickSpy).toHaveBeenCalledTimes(2);
    expect(quickPickSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: "Select target workspace folder"
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
