import * as vscode from "vscode";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { OutputLogger } from "./services/outputLogger";

const {
  runInstallMock,
  runRemoveMock,
  runRepairMock
} = vi.hoisted(() => {
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

    const context = {
      subscriptions: [],
      extension: {
        id: "publisher.codex-onboarding"
      }
    } as unknown as vscode.ExtensionContext;

    activate(context);

    expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(3);
    expect(callbacks.has("codexOnboarding.install")).toBe(true);
    expect(callbacks.has("codexOnboarding.remove")).toBe(true);
    expect(callbacks.has("codexOnboarding.repair")).toBe(true);

    expect(context.subscriptions).toHaveLength(4);

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

  it("deactivate is a safe no-op", () => {
    expect(() => deactivate()).not.toThrow();
  });
});
