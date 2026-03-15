import * as fs from "node:fs/promises";
import * as path from "node:path";

import { LogLevel, LogValue } from "./outputLogger";

interface OperationLogServiceLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

export function buildProjectOperationLogPath(targetRootPath: string, sourceLogPath: string): string {
  return path.join(
    targetRootPath,
    ".codex-onboarding",
    ".managed",
    "logs",
    path.basename(sourceLogPath)
  );
}

export async function mirrorOperationLogToProject(
  targetRootPath: string,
  sourceLogPath: string,
  logger: OperationLogServiceLogger
): Promise<string> {
  const destinationPath = buildProjectOperationLogPath(targetRootPath, sourceLogPath);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourceLogPath, destinationPath);

  logger.log("debug", "operation_log_mirrored", {
    source_log_path: sourceLogPath,
    project_log_path: destinationPath
  });

  return destinationPath;
}
