import * as vscode from "vscode";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runRepair } from "./repairCommand";
import { applyManagedInstall } from "../services/managedInstallService";
import { loadResolvedProfile } from "../services/profileAssetService";
import { loadQuestionnaireAssets } from "../services/questionnaireAssetService";
import { runDynamicQuestionFlow } from "../services/questionnaireFlowRunner";
import { resolveSelectionPlan } from "../services/selectionResolver";
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

describe("runRepair", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createTraceLoggerMock.mockResolvedValue({
      log: vi.fn(),
      flush: vi.fn(),
      logFilePath: "/tmp/storage/operation-logs/repair-log.jsonl"
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
        version: 9,
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
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/workspace/project/.codex-onboarding/.managed",
      appliedFiles: [".codex-onboarding/core/AGENT-ONBOARDING.md"],
      skippedFiles: [],
      recoveredTrackedFiles: [],
      removedStaleFiles: []
    });
  });

  it("blocks when operational questions are cancelled", async () => {
    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "operational_questions_cancelled"
    });
    expect(trace.flush).toHaveBeenCalledTimes(1);
  });

  it("blocks when repair confirmation is declined", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "repair_confirmation_declined"
    });
  });

  it("runs repair flow and applies managed install in repair mode", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue("Repair" as any);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRootPath: "/workspace/project",
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "9",
        extensionVersion: "1.2.3",
        mode: "repair"
      }),
      expect.any(Object)
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("Repair operation completed.")
    );

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("debug", "operation_completed", {
      result_code: "repaired"
    });
    expect(trace.flush).toHaveBeenCalledTimes(1);
  });

  it("shows error message when repair fails", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue("Repair" as any);
    vi.mocked(applyManagedInstall).mockRejectedValue(new Error("repair boom"));

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Repair failed: repair boom");

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({ result_code: "failed", reason: "repair boom" })
    );
    expect(trace.flush).toHaveBeenCalledTimes(1);
  });

  it("blocks when no workspace folder is available", async () => {
    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue(undefined);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No workspace folder is available for repair operation."
    );
    expect(applyManagedInstall).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "no_workspace_folder"
    });
  });

  it("blocks when profile selection questions are cancelled", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files",
      value: "track"
    } as any);

    vi.mocked(runDynamicQuestionFlow).mockResolvedValue(undefined);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "profile_selection_questions_cancelled"
    });
  });

  it("falls back to output logger when trace logger cannot be created", async () => {
    createTraceLoggerMock.mockRejectedValue("trace-create-failed");
    const logger = { log: vi.fn() };

    await runRepair(buildContext(), logger as any);

    expect(logger.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({
        command: "repair",
        result_code: "failed",
        reason: "unknown_error"
      })
    );

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Repair failed: unknown error");
  });
});
