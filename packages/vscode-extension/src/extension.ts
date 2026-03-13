import * as vscode from "vscode";

import { runInstall } from "./commands/installCommand";
import { runRemove } from "./commands/removeCommand";
import { runRepair } from "./commands/repairCommand";
import { OutputLogger } from "./services/outputLogger";

export function activate(context: vscode.ExtensionContext): void {
  const logger = new OutputLogger();
  context.subscriptions.push({ dispose: () => logger.dispose() });

  const install = vscode.commands.registerCommand("codexOnboarding.install", async () => {
    await runInstall(context, logger);
  });

  const remove = vscode.commands.registerCommand("codexOnboarding.remove", async () => {
    await runRemove(logger);
  });

  const repair = vscode.commands.registerCommand("codexOnboarding.repair", async () => {
    await runRepair(logger);
  });

  context.subscriptions.push(install, remove, repair);
  logger.log("debug", "extension_activated", { extension_id: context.extension.id });
}

export function deactivate(): void {
  // No-op. All resources are disposed via context subscriptions.
}
