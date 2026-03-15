import * as vscode from "vscode";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveTargetWorkspaceFolder } from "./workspaceRootResolver";

function folder(name: string, fsPath: string): vscode.WorkspaceFolder {
  return {
    index: 0,
    name,
    uri: { fsPath } as vscode.Uri
  } as vscode.WorkspaceFolder;
}

afterEach(() => {
  vi.restoreAllMocks();
  (vscode.workspace as { workspaceFolders?: vscode.WorkspaceFolder[] }).workspaceFolders = undefined;
});

describe("resolveTargetWorkspaceFolder", () => {
  it("returns undefined when there is no workspace folder", async () => {
    (vscode.workspace as { workspaceFolders?: vscode.WorkspaceFolder[] }).workspaceFolders = undefined;

    const resolved = await resolveTargetWorkspaceFolder();
    expect(resolved).toBeUndefined();
  });

  it("returns the single workspace folder without prompting", async () => {
    const one = folder("api", "/workspace/api");
    (vscode.workspace as { workspaceFolders?: vscode.WorkspaceFolder[] }).workspaceFolders = [one];

    const quickPickSpy = vi.spyOn(vscode.window, "showQuickPick");

    const resolved = await resolveTargetWorkspaceFolder();

    expect(resolved).toBe(one);
    expect(quickPickSpy).not.toHaveBeenCalled();
  });

  it("prompts user when multiple roots exist and returns selected folder", async () => {
    const first = folder("app-1", "/workspace/app-1");
    const second = folder("app-2", "/workspace/app-2");

    (vscode.workspace as { workspaceFolders?: vscode.WorkspaceFolder[] }).workspaceFolders = [first, second];
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: second.name,
      description: second.uri.fsPath,
      folder: second
    } as never);

    const resolved = await resolveTargetWorkspaceFolder();

    expect(resolved).toBe(second);
    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
  });

  it("returns undefined when multi-root picker is cancelled", async () => {
    const first = folder("app-1", "/workspace/app-1");
    const second = folder("app-2", "/workspace/app-2");

    (vscode.workspace as { workspaceFolders?: vscode.WorkspaceFolder[] }).workspaceFolders = [first, second];
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);

    const resolved = await resolveTargetWorkspaceFolder();

    expect(resolved).toBeUndefined();
  });
});
