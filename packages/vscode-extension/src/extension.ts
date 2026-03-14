import * as vscode from "vscode";

import { runInstall } from "./commands/installCommand";
import { runRemove } from "./commands/removeCommand";
import { runRepair } from "./commands/repairCommand";
import { OutputLogger } from "./services/outputLogger";
import { postInstallActions } from "./services/postInstallGuidancePage";

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

  const reportIssue = vscode.commands.registerCommand(postInstallActions.reportIssue, async () => {
    await vscode.env.openExternal(vscode.Uri.parse(postInstallActions.reportIssueUrl));
  });

  context.subscriptions.push(install, remove, repair, copyStarterPrompt, reportIssue);
  logger.log("debug", "extension_activated", { extension_id: context.extension.id });
}

export function deactivate(): void {
  // No-op. All resources are disposed via context subscriptions.
}
