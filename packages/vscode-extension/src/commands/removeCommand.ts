import * as vscode from "vscode";

import { OutputLogger } from "../services/outputLogger";

export async function runRemove(logger: OutputLogger): Promise<void> {
  const operationId = `remove-${Date.now()}`;
  logger.log("debug", "operation_started", { command: "remove", operation_id: operationId });

  void vscode.window.showInformationMessage(
    "Remove command scaffold is active. Managed remove logic will be implemented in the next step."
  );

  logger.log("debug", "operation_completed", {
    operation_id: operationId,
    result_code: "scaffold_only"
  });
}
