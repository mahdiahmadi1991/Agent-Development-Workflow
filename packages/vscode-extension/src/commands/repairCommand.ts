import * as vscode from "vscode";

import { OutputLogger } from "../services/outputLogger";

export async function runRepair(logger: OutputLogger): Promise<void> {
  const operationId = `repair-${Date.now()}`;
  logger.log("debug", "operation_started", { command: "repair", operation_id: operationId });

  void vscode.window.showInformationMessage(
    "Repair command scaffold is active. Managed repair logic will be implemented in the next step."
  );

  logger.log("debug", "operation_completed", {
    operation_id: operationId,
    result_code: "scaffold_only"
  });
}
