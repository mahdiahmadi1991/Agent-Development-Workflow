import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as vscode from "vscode";

import { LogLevel, LogValue, OutputLogger } from "./outputLogger";

export type LifecycleCommand = "install" | "remove" | "repair";

type Fields = Record<string, LogValue>;

function sanitizeTimestamp(value: string): string {
  return value.replace(/[:.]/g, "-");
}

function normalizeForJson(fields: Fields): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

export class OperationTraceLogger {
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly output: OutputLogger,
    private readonly command: LifecycleCommand,
    private readonly operationId: string,
    public readonly traceId: string,
    public readonly logFilePath: string
  ) {}

  public static async create(
    context: vscode.ExtensionContext,
    output: OutputLogger,
    command: LifecycleCommand,
    operationId: string
  ): Promise<OperationTraceLogger> {
    const traceId = crypto
      .createHash("sha1")
      .update(`${command}:${operationId}`)
      .digest("hex")
      .slice(0, 16);

    const logsDirectory = path.join(context.globalStorageUri.fsPath, "operation-logs");
    await fs.mkdir(logsDirectory, { recursive: true });

    const timestamp = sanitizeTimestamp(new Date().toISOString());
    const logFilePath = path.join(logsDirectory, `${command}-${timestamp}-${operationId}.jsonl`);
    await fs.writeFile(logFilePath, "", "utf8");

    return new OperationTraceLogger(output, command, operationId, traceId, logFilePath);
  }

  public log(level: LogLevel, event: string, fields: Fields = {}): void {
    const enriched: Fields = {
      ...fields,
      operation_id: this.operationId,
      command: this.command,
      trace_id: this.traceId
    };

    this.output.log(level, event, enriched);

    const record = {
      timestamp: new Date().toISOString(),
      severity: level,
      event,
      ...normalizeForJson(enriched)
    };

    const line = `${JSON.stringify(record)}\n`;
    this.writeQueue = this.writeQueue
      .then(async () => {
        await fs.appendFile(this.logFilePath, line, "utf8");
      })
      .catch(async () => {
        // Never throw from logging pipeline; keep command flow safe.
      });
  }

  public async flush(): Promise<void> {
    await this.writeQueue;
  }
}
