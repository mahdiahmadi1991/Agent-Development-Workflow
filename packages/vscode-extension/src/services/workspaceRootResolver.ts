import * as vscode from "vscode";

export async function resolveTargetWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];

  if (folders.length === 0) {
    return undefined;
  }

  if (folders.length === 1) {
    return folders[0];
  }

  const pick = await vscode.window.showQuickPick(
    folders.map((f) => ({
      label: f.name,
      description: f.uri.fsPath,
      folder: f
    })),
    {
      title: "Installation Scope",
      placeHolder: "Select the workspace root for onboarding changes"
    }
  );

  return pick?.folder;
}
