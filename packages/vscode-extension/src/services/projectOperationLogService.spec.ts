import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildProjectOperationLogPath,
  mirrorOperationLogToProject
} from "./projectOperationLogService";

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const root = cleanups.pop();
    if (root) {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
});

describe("projectOperationLogService", () => {
  it("builds deterministic project log path under managed logs directory", () => {
    const pathValue = buildProjectOperationLogPath(
      "/workspace/project",
      "/tmp/storage/operation-logs/install-2026-03-15-id.jsonl"
    );

    expect(pathValue).toBe(
      "/workspace/project/.codex-onboarding/.managed/logs/install-2026-03-15-id.jsonl"
    );
  });

  it("copies operation log file into project managed log directory", async () => {
    const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-log-mirror-"));
    cleanups.push(targetRoot);

    const sourcePath = path.join(targetRoot, "source-install-log.jsonl");
    const sourceContent = JSON.stringify({ event: "operation_started" }) + "\n";
    await fs.writeFile(sourcePath, sourceContent, "utf8");

    const logger = { log: vi.fn() };
    const mirroredPath = await mirrorOperationLogToProject(targetRoot, sourcePath, logger);

    await expect(fs.readFile(mirroredPath, "utf8")).resolves.toBe(sourceContent);
    expect(logger.log).toHaveBeenCalledWith(
      "debug",
      "operation_log_mirrored",
      expect.objectContaining({
        source_log_path: sourcePath,
        project_log_path: mirroredPath
      })
    );
  });
});
