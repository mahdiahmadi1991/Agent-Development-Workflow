import * as vscode from "vscode";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { OutputLogger } from "./services/outputLogger";
import { postInstallActions } from "./services/postInstallGuidancePage";

const { runInstallMock, runRemoveMock, runRepairMock } = vi.hoisted(() => {
  return {
    runInstallMock: vi.fn(),
    runRemoveMock: vi.fn(),
    runRepairMock: vi.fn()
  };
});

vi.mock("./commands/installCommand", () => ({
  runInstall: runInstallMock
}));

vi.mock("./commands/removeCommand", () => ({
  runRemove: runRemoveMock
}));

vi.mock("./commands/repairCommand", () => ({
  runRepair: runRepairMock
}));

import { activate, deactivate } from "./extension";

function buildContext(): vscode.ExtensionContext {
  return {
    subscriptions: [],
    extension: {
      id: "publisher.codex-onboarding"
    }
  } as unknown as vscode.ExtensionContext;
}

describe("extension activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers commands and wires handlers to command implementations", async () => {
    const callbacks = new Map<string, (...args: unknown[]) => unknown>();

    vi.spyOn(vscode.commands, "registerCommand").mockImplementation((id, callback) => {
      callbacks.set(id, callback as (...args: unknown[]) => unknown);
      return { dispose: vi.fn() } as unknown as vscode.Disposable;
    });

    const outputLogSpy = vi.spyOn(OutputLogger.prototype, "log");
    const outputShowSpy = vi.spyOn(OutputLogger.prototype, "show");

    const context = buildContext();

    activate(context);

    expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(6);
    expect(callbacks.has("codexOnboarding.install")).toBe(true);
    expect(callbacks.has("codexOnboarding.remove")).toBe(true);
    expect(callbacks.has("codexOnboarding.repair")).toBe(true);
    expect(callbacks.has(postInstallActions.openManagedRoot)).toBe(true);
    expect(callbacks.has(postInstallActions.openOperationLog)).toBe(true);
    expect(callbacks.has(postInstallActions.copyStarterPrompt)).toBe(true);

    expect(context.subscriptions).toHaveLength(7);

    expect(outputLogSpy).toHaveBeenCalledWith("debug", "extension_activated", {
      extension_id: "publisher.codex-onboarding"
    });

    await callbacks.get("codexOnboarding.install")?.();
    await callbacks.get("codexOnboarding.remove")?.();
    await callbacks.get("codexOnboarding.repair")?.();

    expect(runInstallMock).toHaveBeenCalledTimes(1);
    expect(runRemoveMock).toHaveBeenCalledTimes(1);
    expect(runRepairMock).toHaveBeenCalledTimes(1);

    const installLoggerArg = runInstallMock.mock.calls[0][1];
    const removeLoggerArg = runRemoveMock.mock.calls[0][1];
    const repairLoggerArg = runRepairMock.mock.calls[0][1];

    expect(runInstallMock.mock.calls[0][0]).toBe(context);
    expect(runRemoveMock.mock.calls[0][0]).toBe(context);
    expect(runRepairMock.mock.calls[0][0]).toBe(context);

    expect(installLoggerArg).toBeInstanceOf(OutputLogger);
    expect(removeLoggerArg).toBe(installLoggerArg);
    expect(repairLoggerArg).toBe(installLoggerArg);
    expect(outputShowSpy).toHaveBeenCalledTimes(3);
  });

  it("copies starter prompt via internal post-install action", async () => {
    const callbacks = new Map<string, (...args: unknown[]) => unknown>();

    vi.spyOn(vscode.commands, "registerCommand").mockImplementation((id, callback) => {
      callbacks.set(id, callback as (...args: unknown[]) => unknown);
      return { dispose: vi.fn() } as unknown as vscode.Disposable;
    });

    const writeTextSpy = vi.spyOn(vscode.env.clipboard, "writeText").mockResolvedValue();
    const infoSpy = vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined);

    activate(buildContext());

    await callbacks.get(postInstallActions.copyStarterPrompt)?.("prompt text");

    expect(writeTextSpy).toHaveBeenCalledWith("prompt text");
    expect(infoSpy).toHaveBeenCalledWith("Starter prompt copied to clipboard.");
  });

  it("reveals managed root from internal post-install action", async () => {
    const callbacks = new Map<string, (...args: unknown[]) => unknown>();

    vi.spyOn(vscode.commands, "registerCommand").mockImplementation((id, callback) => {
      callbacks.set(id, callback as (...args: unknown[]) => unknown);
      return { dispose: vi.fn() } as unknown as vscode.Disposable;
    });

    const executeSpy = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);

    activate(buildContext());

    await callbacks.get(postInstallActions.openManagedRoot)?.("/workspace/project/.codex-onboarding");

    expect(executeSpy).toHaveBeenCalledWith(
      "revealInExplorer",
      expect.objectContaining({ fsPath: "/workspace/project/.codex-onboarding" })
    );
  });

  it("opens operation log in editor via internal post-install action", async () => {
    const callbacks = new Map<string, (...args: unknown[]) => unknown>();

    vi.spyOn(vscode.commands, "registerCommand").mockImplementation((id, callback) => {
      callbacks.set(id, callback as (...args: unknown[]) => unknown);
      return { dispose: vi.fn() } as unknown as vscode.Disposable;
    });

    const openTextDocumentSpy = vi.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue({
      uri: vscode.Uri.file("/tmp/storage/operation-logs/install-log.jsonl")
    } as unknown as vscode.TextDocument);
    const showTextDocumentSpy = vi.spyOn(vscode.window, "showTextDocument").mockResolvedValue(
      {} as unknown as vscode.TextEditor
    );

    activate(buildContext());

    await callbacks.get(postInstallActions.openOperationLog)?.("/tmp/storage/operation-logs/install-log.jsonl");

    expect(openTextDocumentSpy).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: "/tmp/storage/operation-logs/install-log.jsonl" })
    );
    expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
  });

  it("shows warning when copy-starter action has no prompt payload", async () => {
    const callbacks = new Map<string, (...args: unknown[]) => unknown>();

    vi.spyOn(vscode.commands, "registerCommand").mockImplementation((id, callback) => {
      callbacks.set(id, callback as (...args: unknown[]) => unknown);
      return { dispose: vi.fn() } as unknown as vscode.Disposable;
    });

    const writeTextSpy = vi.spyOn(vscode.env.clipboard, "writeText").mockResolvedValue();
    const warningSpy = vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);

    activate(buildContext());

    await callbacks.get(postInstallActions.copyStarterPrompt)?.();

    expect(writeTextSpy).not.toHaveBeenCalled();
    expect(warningSpy).toHaveBeenCalledWith("Starter prompt is unavailable.");
  });

  it("deactivate is a safe no-op", () => {
    expect(() => deactivate()).not.toThrow();
  });
});
