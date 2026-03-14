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

    const context = buildContext();

    activate(context);

    expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(5);
    expect(callbacks.has("codexOnboarding.install")).toBe(true);
    expect(callbacks.has("codexOnboarding.remove")).toBe(true);
    expect(callbacks.has("codexOnboarding.repair")).toBe(true);
    expect(callbacks.has(postInstallActions.copyStarterPrompt)).toBe(true);
    expect(callbacks.has(postInstallActions.reportIssue)).toBe(true);

    expect(context.subscriptions).toHaveLength(6);

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

  it("opens external issue url via report-issue action", async () => {
    const callbacks = new Map<string, (...args: unknown[]) => unknown>();

    vi.spyOn(vscode.commands, "registerCommand").mockImplementation((id, callback) => {
      callbacks.set(id, callback as (...args: unknown[]) => unknown);
      return { dispose: vi.fn() } as unknown as vscode.Disposable;
    });

    const openExternalSpy = vi.spyOn(vscode.env, "openExternal").mockResolvedValue(true);

    activate(buildContext());

    await callbacks.get(postInstallActions.reportIssue)?.();

    expect(openExternalSpy).toHaveBeenCalledTimes(1);
    const uriArg = openExternalSpy.mock.calls[0][0] as { toString: () => string };
    expect(uriArg.toString()).toContain("https://github.com/mahdiahmadi1991/Codex-Onboarding-Workflow/issues/new");
  });

  it("deactivate is a safe no-op", () => {
    expect(() => deactivate()).not.toThrow();
  });
});
