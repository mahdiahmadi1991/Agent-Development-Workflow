import * as vscode from "vscode";

import { runInstall } from "./commands/installCommand";
import { runRemove } from "./commands/removeCommand";
import { runRepair } from "./commands/repairCommand";
import { OutputLogger } from "./services/outputLogger";
import { postInstallActions } from "./services/postInstallGuidancePage";

function toNormalizedPath(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function revealInExplorer(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.commands.executeCommand("revealInExplorer", uri);
    return true;
  } catch {
    return false;
  }
}

async function revealInOs(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.commands.executeCommand("revealFileInOS", uri);
    return true;
  } catch {
    return false;
  }
}

async function openExternal(uri: vscode.Uri): Promise<boolean> {
  try {
    return await vscode.env.openExternal(uri);
  } catch {
    return false;
  }
}

async function openManagedRootPath(filePath: string, missingPathMessage: string): Promise<void> {
  const normalized = filePath.trim();
  if (!normalized) {
    await vscode.window.showWarningMessage(missingPathMessage);
    return;
  }

  const uri = vscode.Uri.file(normalized);
  if (await revealInExplorer(uri)) {
    return;
  }

  if (await revealInOs(uri)) {
    return;
  }

  if (await openExternal(uri)) {
    return;
  }

  await vscode.window.showErrorMessage(`Could not open managed root: ${normalized}`);
}

async function openOperationLogPath(filePath: string, missingPathMessage: string): Promise<void> {
  const normalized = filePath.trim();
  if (!normalized) {
    await vscode.window.showWarningMessage(missingPathMessage);
    return;
  }

  const uri = vscode.Uri.file(normalized);

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false, preserveFocus: false });
    return;
  } catch {
    // Fall through to alternative open strategies.
  }

  if (await revealInExplorer(uri)) {
    return;
  }

  if (await revealInOs(uri)) {
    return;
  }

  if (await openExternal(uri)) {
    return;
  }

  await vscode.window.showErrorMessage(`Could not open operation log: ${normalized}`);
}

export function activate(context: vscode.ExtensionContext): void {
  const logger = new OutputLogger();
  context.subscriptions.push({ dispose: () => logger.dispose() });

  const install = vscode.commands.registerCommand("codexOnboarding.install", async () => {
    await runInstall(context, logger);
  });

  const remove = vscode.commands.registerCommand("codexOnboarding.remove", async () => {
    await runRemove(context, logger);
  });

  const repair = vscode.commands.registerCommand("codexOnboarding.repair", async () => {
    await runRepair(context, logger);
  });

  const copyStarterPrompt = vscode.commands.registerCommand(postInstallActions.copyStarterPrompt, async (prompt?: string) => {
    const value = typeof prompt === "string" ? prompt.trim() : "";

    if (!value) {
      await vscode.window.showWarningMessage("Starter prompt is unavailable.");
      return;
    }

    await vscode.env.clipboard.writeText(value);
    await vscode.window.showInformationMessage("Starter prompt copied to clipboard.");
  });

  const openManagedRoot = vscode.commands.registerCommand(postInstallActions.openManagedRoot, async (managedRootPath?: string) => {
    await openManagedRootPath(
      toNormalizedPath(managedRootPath),
      "Managed root path is unavailable."
    );
  });

  const openOperationLog = vscode.commands.registerCommand(postInstallActions.openOperationLog, async (logFilePath?: string) => {
    await openOperationLogPath(
      toNormalizedPath(logFilePath),
      "Operation log path is unavailable."
    );
  });

  context.subscriptions.push(
    install,
    remove,
    repair,
    openManagedRoot,
    openOperationLog,
    copyStarterPrompt
  );
  logger.log("debug", "extension_activated", { extension_id: context.extension.id });
}

export function deactivate(): void {
  // No-op. All resources are disposed via context subscriptions.
}
