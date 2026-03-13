import * as vscode from "vscode";

import { OperationTraceLogger } from "../services/operationTraceLogger";
import { OutputLogger } from "../services/outputLogger";

export async function runRemove(
  context: vscode.ExtensionContext,
  logger: OutputLogger
): Promise<void> {
  const operationId = `remove-${Date.now()}`;
  let traceLogger: OperationTraceLogger | undefined;

  try {
    traceLogger = await OperationTraceLogger.create(context, logger, "remove", operationId);

    traceLogger.log("debug", "operation_started", {
      log_file: traceLogger.logFilePath
    });

    const message = [
      "Remove command scaffold is active.",
      "Managed remove logic will be implemented in the next step.",
      `Operation log: ${traceLogger.logFilePath}`
    ].join("\n");

    void vscode.window.showInformationMessage(message);

    traceLogger.log("debug", "success_notification_shown", {
      result_code: "scaffold_only"
    });

    traceLogger.log("debug", "operation_completed", {
      result_code: "scaffold_only"
    });
  } catch (error) {
    if (traceLogger) {
      traceLogger.log("error", "operation_completed", {
        result_code: "failed",
        reason: error instanceof Error ? error.message : "unknown_error"
      });
    } else {
      logger.log("error", "operation_completed", {
        operation_id: operationId,
        command: "remove",
        result_code: "failed",
        reason: error instanceof Error ? error.message : "unknown_error"
      });
    }

    void vscode.window.showErrorMessage(
      error instanceof Error ? `Remove failed: ${error.message}` : "Remove failed: unknown error"
    );
  } finally {
    if (traceLogger) {
      await traceLogger.flush();
    }
  }
}
