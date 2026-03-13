import * as vscode from "vscode";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runRemove } from "./removeCommand";
import { removeManagedOnboarding } from "../services/managedRemoveService";
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

vi.mock("../services/managedRemoveService", () => ({
  removeManagedOnboarding: vi.fn()
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

describe("runRemove", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createTraceLoggerMock.mockResolvedValue({
      log: vi.fn(),
      flush: vi.fn(),
      logFilePath: "/tmp/storage/operation-logs/remove-log.jsonl"
    });

    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: "/workspace/project" }
    } as unknown as vscode.WorkspaceFolder);

    vi.mocked(removeManagedOnboarding).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      hadState: true,
      stateCleared: true,
      stateCorrupt: false,
      removedFiles: [".codex-onboarding/core/AGENT-ONBOARDING.md"],
      preservedModifiedFiles: [],
      missingManagedFiles: []
    });
  });

  it("blocks when no workspace folder is available", async () => {
    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue(undefined);

    await runRemove(buildContext(), { log: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No workspace folder is available for remove operation."
    );
    expect(removeManagedOnboarding).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "no_workspace_folder"
    });
  });

  it("blocks when remove confirmation is declined", async () => {
    vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);

    await runRemove(buildContext(), { log: vi.fn() } as any);

    expect(removeManagedOnboarding).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "remove_confirmation_declined"
    });
  });

  it("removes managed onboarding and shows completion summary", async () => {
    vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue("Remove" as any);

    await runRemove(buildContext(), { log: vi.fn() } as any);

    expect(removeManagedOnboarding).toHaveBeenCalledWith(
      "/workspace/project",
      expect.any(Object)
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("Remove operation completed.")
    );

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("debug", "operation_completed", {
      result_code: "removed"
    });
    expect(trace.flush).toHaveBeenCalledTimes(1);
  });

  it("shows error message when remove fails", async () => {
    vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue("Remove" as any);
    vi.mocked(removeManagedOnboarding).mockRejectedValue(new Error("remove boom"));

    await runRemove(buildContext(), { log: vi.fn() } as any);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Remove failed: remove boom");

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({ result_code: "failed", reason: "remove boom" })
    );
    expect(trace.flush).toHaveBeenCalledTimes(1);
  });

  it("falls back to output logger when trace logger cannot be created", async () => {
    createTraceLoggerMock.mockRejectedValue("trace-create-failed");
    const logger = { log: vi.fn() };

    await runRemove(buildContext(), logger as any);

    expect(logger.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({
        command: "remove",
        result_code: "failed",
        reason: "unknown_error"
      })
    );

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Remove failed: unknown error");
  });
});
