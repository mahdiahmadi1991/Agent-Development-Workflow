import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { OperationTraceLogger } from "./operationTraceLogger";

const cleanups: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();

  while (cleanups.length > 0) {
    const root = cleanups.pop();
    if (root) {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
});

async function createContextRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  cleanups.push(root);
  return root;
}

describe("OperationTraceLogger", () => {
  it("creates unique log file path under global storage operation-logs", async () => {
    const root = await createContextRoot("trace-logger-create");

    const logger = await OperationTraceLogger.create(
      {
        globalStorageUri: { fsPath: root }
      } as any,
      { log: vi.fn() } as any,
      "install",
      "install-123"
    );

    expect(logger.logFilePath).toContain(path.join(root, "operation-logs"));
    expect(path.basename(logger.logFilePath)).toMatch(/^install-.*-install-123\.jsonl$/);

    const raw = await fs.readFile(logger.logFilePath, "utf8");
    expect(raw).toBe("");
  });

  it("writes structured records with enriched operation fields", async () => {
    const root = await createContextRoot("trace-logger-write");
    const output = { log: vi.fn() };

    const logger = await OperationTraceLogger.create(
      {
        globalStorageUri: { fsPath: root }
      } as any,
      output as any,
      "repair",
      "repair-1"
    );

    logger.log("debug", "event_a", {
      alpha: "x",
      beta: 2,
      gamma: undefined
    });

    logger.log("warning", "event_b", {
      reason: "test"
    });

    await logger.flush();

    const raw = await fs.readFile(logger.logFilePath, "utf8");
    const lines = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(lines).toHaveLength(2);
    expect(lines[0].event).toBe("event_a");
    expect(lines[0].severity).toBe("debug");
    expect(lines[0].command).toBe("repair");
    expect(lines[0].operation_id).toBe("repair-1");
    expect(lines[0]).not.toHaveProperty("gamma");

    expect(lines[1].event).toBe("event_b");
    expect(lines[1].severity).toBe("warning");

    expect(output.log).toHaveBeenCalledTimes(2);
    expect(output.log).toHaveBeenCalledWith(
      "debug",
      "event_a",
      expect.objectContaining({
        alpha: "x",
        beta: 2,
        command: "repair",
        operation_id: "repair-1"
      })
    );
  });

  it("does not throw when append operation fails", async () => {
    const root = await createContextRoot("trace-logger-failure-tolerance");

    const output = { log: vi.fn() };
    const logger = await OperationTraceLogger.create(
      {
        globalStorageUri: { fsPath: root }
      } as any,
      output as any,
      "remove",
      "remove-1"
    );

    const brokenPath = path.join(root, "operation-logs", "broken-dir");
    await fs.mkdir(brokenPath, { recursive: true });
    (logger as any).logFilePath = brokenPath;

    expect(() => {
      logger.log("error", "write_attempt", {
        reason: "simulate_failure"
      });
    }).not.toThrow();

    await expect(logger.flush()).resolves.toBeUndefined();
    expect(output.log).toHaveBeenCalledWith(
      "error",
      "write_attempt",
      expect.objectContaining({
        reason: "simulate_failure",
        command: "remove",
        operation_id: "remove-1"
      })
    );
  });
});
