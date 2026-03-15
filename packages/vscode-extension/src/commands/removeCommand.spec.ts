import * as vscode from "vscode";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runRemove } from "./removeCommand";
import { applyGitTrackingMode } from "../services/gitTrackingService";
import {
  analyzeManagedRemoveImpact,
  removeManagedOnboarding
} from "../services/managedRemoveService";
import { removeRootAgentsIntegration } from "../services/rootAgentsIntegrationService";
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
  analyzeManagedRemoveImpact: vi.fn(),
  removeManagedOnboarding: vi.fn()
}));

vi.mock("../services/gitTrackingService", () => ({
  applyGitTrackingMode: vi.fn()
}));

vi.mock("../services/rootAgentsIntegrationService", () => ({
  removeRootAgentsIntegration: vi.fn()
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
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);
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
      removedFiles: [".codex-onboarding/AGENTS.md"],
      missingManagedFiles: [],
      skippedChangedManagedFiles: [],
      removedManagedRoot: false,
      removeMode: "safe_state_cleanup"
    });
    vi.mocked(analyzeManagedRemoveImpact).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/workspace/project/.codex-onboarding",
      hadState: true,
      stateCorrupt: false,
      modifiedManagedFiles: [],
      missingManagedFiles: [],
      untrackedFiles: [],
      requiresConfirmation: false
    });
    vi.mocked(applyGitTrackingMode).mockResolvedValue({
      mode: "track",
      strategy: "git_info_exclude",
      updated: true,
      excludePath: "/workspace/project/.git/info/exclude"
    });
    vi.mocked(removeRootAgentsIntegration).mockResolvedValue({
      status: "removed",
      rootAgentsPath: "/workspace/project/AGENTS.md"
    });
  });

  it("blocks when no workspace folder is available", async () => {
    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue(undefined);

    await runRemove(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No workspace folder is available for remove operation."
    );
    expect(analyzeManagedRemoveImpact).not.toHaveBeenCalled();
    expect(removeManagedOnboarding).not.toHaveBeenCalled();
    expect(applyGitTrackingMode).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "no_workspace_folder"
    });
  });

  it("cancels remove at installation scope when workspace picker is dismissed", async () => {
    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue(undefined);
    (vscode.workspace as unknown as { workspaceFolders: vscode.WorkspaceFolder[] }).workspaceFolders = [
      { name: "project", uri: { fsPath: "/workspace/project" } } as unknown as vscode.WorkspaceFolder
    ];

    await runRemove(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "Remove canceled at Installation Scope."
    );

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "target_scope_cancelled"
    });

    (vscode.workspace as unknown as { workspaceFolders: vscode.WorkspaceFolder[] | undefined }).workspaceFolders =
      undefined;
  });

  it("blocks when remove confirmation is declined after change detection", async () => {
    vi.mocked(analyzeManagedRemoveImpact).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/workspace/project/.codex-onboarding",
      hadState: true,
      stateCorrupt: false,
      modifiedManagedFiles: [".codex-onboarding/AGENTS.md"],
      missingManagedFiles: [],
      untrackedFiles: [],
      requiresConfirmation: true
    });
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);

    await runRemove(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(removeManagedOnboarding).not.toHaveBeenCalled();
    expect(applyGitTrackingMode).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "remove_confirmation_declined_after_drift_warning"
    });
  });

  it("blocks when remove confirmation explicitly selects No", async () => {
    vi.mocked(analyzeManagedRemoveImpact).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/workspace/project/.codex-onboarding",
      hadState: true,
      stateCorrupt: false,
      modifiedManagedFiles: [".codex-onboarding/AGENTS.md"],
      missingManagedFiles: [],
      untrackedFiles: [],
      requiresConfirmation: true
    });
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "No"
    } as any);

    await runRemove(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(removeManagedOnboarding).not.toHaveBeenCalled();
    expect(applyGitTrackingMode).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Remove canceled.");
  });

  it("removes managed onboarding without confirmation when no changes were detected", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);
    const logger = { log: vi.fn(), show: vi.fn() };

    await runRemove(buildContext(), logger as any);

    expect(analyzeManagedRemoveImpact).toHaveBeenCalledWith(
      "/workspace/project",
      expect.any(Object)
    );
    expect(removeManagedOnboarding).toHaveBeenCalledWith(
      "/workspace/project",
      expect.any(Object),
      { removeWholeManagedRoot: false }
    );
    expect(applyGitTrackingMode).toHaveBeenCalledWith(
      {
        targetRootPath: "/workspace/project",
        mode: "track"
      },
      expect.any(Object)
    );
    expect(removeRootAgentsIntegration).toHaveBeenCalledWith(
      "/workspace/project",
      expect.any(Object)
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("Remove operation completed.")
    );
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
    expect(logger.show).not.toHaveBeenCalled();

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("debug", "operation_completed", {
      result_code: "removed"
    });
    expect(trace.flush).toHaveBeenCalledTimes(1);
  });

  it("uses full-root reset remove mode when changes are detected and user confirms", async () => {
    vi.mocked(analyzeManagedRemoveImpact).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/workspace/project/.codex-onboarding",
      hadState: true,
      stateCorrupt: false,
      modifiedManagedFiles: [".codex-onboarding/core/topics/cross-cutting/base-topic.md"],
      missingManagedFiles: [],
      untrackedFiles: [".codex-onboarding/custom/user-note.md"],
      requiresConfirmation: true
    });
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Remove Entire .codex-onboarding Folder (Discard Changes)"
    } as any);
    vi.mocked(removeManagedOnboarding).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      hadState: true,
      stateCleared: true,
      stateCorrupt: false,
      removedFiles: [".codex-onboarding/AGENTS.md", ".codex-onboarding/custom/user-note.md"],
      missingManagedFiles: [],
      skippedChangedManagedFiles: [],
      removedManagedRoot: true,
      removeMode: "full_root_reset"
    });

    await runRemove(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(removeManagedOnboarding).toHaveBeenCalledWith(
      "/workspace/project",
      expect.any(Object),
      { removeWholeManagedRoot: true }
    );
  });

  it("shows corrupt-state details in remove confirmation prompt", async () => {
    vi.mocked(analyzeManagedRemoveImpact).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/workspace/project/.codex-onboarding",
      hadState: true,
      stateCorrupt: true,
      modifiedManagedFiles: [],
      missingManagedFiles: [],
      untrackedFiles: [".codex-onboarding/custom/user-note.md"],
      requiresConfirmation: true
    });
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Remove Entire .codex-onboarding Folder (Discard Changes)"
    } as any);

    await runRemove(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        placeHolder: expect.stringContaining("state corrupt: yes")
      })
    );
  });

  it("shows error message when remove fails", async () => {
    vi.mocked(removeManagedOnboarding).mockRejectedValue(new Error("remove boom"));
    const logger = { log: vi.fn(), show: vi.fn() };

    await runRemove(buildContext(), logger as any);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Remove failed: remove boom");
    expect(logger.show).toHaveBeenCalledTimes(1);

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({ result_code: "failed", reason: "remove boom" })
    );
    expect(trace.flush).toHaveBeenCalledTimes(1);
  });

  it("logs unknown error reason when remove fails with non-Error throw", async () => {
    vi.mocked(removeManagedOnboarding).mockRejectedValue("boom-string");
    const logger = { log: vi.fn(), show: vi.fn() };

    await runRemove(buildContext(), logger as any);

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({ result_code: "failed", reason: "unknown_error" })
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Remove failed: unknown error");
  });

  it("falls back to output logger when trace logger cannot be created", async () => {
    createTraceLoggerMock.mockRejectedValue("trace-create-failed");
    const logger = { log: vi.fn(), show: vi.fn() };

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
    expect(logger.show).toHaveBeenCalledTimes(1);
  });

  it("falls back to output logger with explicit message when trace logger creation throws Error", async () => {
    createTraceLoggerMock.mockRejectedValue(new Error("trace init failed"));
    const logger = { log: vi.fn(), show: vi.fn() };

    await runRemove(buildContext(), logger as any);

    expect(logger.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({
        command: "remove",
        result_code: "failed",
        reason: "trace init failed"
      })
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Remove failed: trace init failed");
  });

  it("prints 'no' flags in summary when git update and state clear are false", async () => {
    vi.mocked(applyGitTrackingMode).mockResolvedValue({
      mode: "track",
      strategy: "git_info_exclude",
      updated: false,
      excludePath: "/workspace/project/.git/info/exclude"
    });
    vi.mocked(removeManagedOnboarding).mockResolvedValue({
      statePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      hadState: true,
      stateCleared: false,
      stateCorrupt: false,
      removedFiles: [],
      missingManagedFiles: [],
      skippedChangedManagedFiles: [],
      removedManagedRoot: false,
      removeMode: "safe_state_cleanup"
    });

    await runRemove(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("Git tracking cleanup updated: no")
    );
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("State cleared: no")
    );
  });
});
