import * as fs from "node:fs/promises";
import * as path from "node:path";

import { LogLevel, LogValue } from "./outputLogger";

interface GitTrackingLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

export type GitTrackingMode = "track" | "ignore";

export interface GitTrackingSyncInput {
  targetRootPath: string;
  mode: GitTrackingMode;
}

export interface GitTrackingSyncResult {
  mode: GitTrackingMode;
  strategy: "git_info_exclude" | "no_git_repository";
  updated: boolean;
  excludePath?: string;
}

const MANAGED_BLOCK_START = "# >>> codex-onboarding managed ignore (start) >>>";
const MANAGED_BLOCK_END = "# <<< codex-onboarding managed ignore (end) <<<";
const MANAGED_IGNORE_ENTRIES = [
  ".codex-onboarding/core/",
  ".codex-onboarding/.managed/"
];

function renderManagedIgnoreBlock(): string {
  return [MANAGED_BLOCK_START, ...MANAGED_IGNORE_ENTRIES, MANAGED_BLOCK_END].join("\n");
}

function removeManagedIgnoreBlock(content: string): { content: string; changed: boolean } {
  const lines = content.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === MANAGED_BLOCK_START);
  if (startIndex === -1) {
    return { content, changed: false };
  }

  const endIndex = lines.findIndex((line, index) => index > startIndex && line.trim() === MANAGED_BLOCK_END);
  const removeUntil = endIndex === -1 ? lines.length - 1 : endIndex;

  lines.splice(startIndex, removeUntil - startIndex + 1);

  const normalized = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  return { content: normalized, changed: true };
}

function withTrailingNewline(content: string): string {
  if (!content) {
    return "";
  }

  return content.endsWith("\n") ? content : `${content}\n`;
}

async function resolveGitDirectoryPath(targetRootPath: string): Promise<string | undefined> {
  const gitPath = path.join(targetRootPath, ".git");

  try {
    const stats = await fs.stat(gitPath);
    if (stats.isDirectory()) {
      return gitPath;
    }

    if (!stats.isFile()) {
      throw new Error("Unsupported .git entry type.");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }

  const gitPointerRaw = await fs.readFile(gitPath, "utf8");
  const gitdirLine = gitPointerRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^gitdir:\s*/i.test(line));

  if (!gitdirLine) {
    throw new Error("Invalid .git file: missing gitdir pointer.");
  }

  const rawGitDir = gitdirLine.replace(/^gitdir:\s*/i, "").trim();
  if (!rawGitDir) {
    throw new Error("Invalid .git file: gitdir pointer is empty.");
  }

  return path.resolve(targetRootPath, rawGitDir);
}

export async function hasGitRepository(targetRootPath: string): Promise<boolean> {
  const gitDirPath = await resolveGitDirectoryPath(targetRootPath);
  return Boolean(gitDirPath);
}

async function readFileIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function applyGitTrackingMode(
  input: GitTrackingSyncInput,
  logger: GitTrackingLogger
): Promise<GitTrackingSyncResult> {
  logger.log("debug", "git_tracking_sync_started", {
    target_root: input.targetRootPath,
    git_mode: input.mode
  });

  const gitDirPath = await resolveGitDirectoryPath(input.targetRootPath);
  if (!gitDirPath) {
    logger.log("warning", "git_tracking_sync_skipped", {
      reason: "no_git_repository",
      git_mode: input.mode
    });

    return {
      mode: input.mode,
      strategy: "no_git_repository",
      updated: false
    };
  }

  const excludePath = path.join(gitDirPath, "info", "exclude");
  const currentContent = (await readFileIfExists(excludePath)) ?? "";
  const { content: withoutManagedBlock } = removeManagedIgnoreBlock(currentContent);

  let nextContent = withoutManagedBlock.trimEnd();

  if (input.mode === "ignore") {
    const block = renderManagedIgnoreBlock();
    nextContent = nextContent.length > 0 ? `${nextContent}\n\n${block}` : block;
  }

  nextContent = withTrailingNewline(nextContent);

  if (nextContent !== currentContent) {
    await fs.mkdir(path.dirname(excludePath), { recursive: true });
    await fs.writeFile(excludePath, nextContent, "utf8");
  }

  logger.log("debug", "git_tracking_sync_completed", {
    git_mode: input.mode,
    strategy: "git_info_exclude",
    updated: nextContent !== currentContent,
    exclude_path: excludePath
  });

  return {
    mode: input.mode,
    strategy: "git_info_exclude",
    updated: nextContent !== currentContent,
    excludePath
  };
}
