import * as fs from "node:fs/promises";
import * as path from "node:path";

import { LogLevel, LogValue } from "./outputLogger";

interface RootAgentsLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

export const ROOT_AGENTS_RELATIVE_PATH = "AGENTS.md";
export const ONBOARDING_INDEX_REFERENCE = ".codex-onboarding/INDEX.md";
export const ROOT_AGENTS_POINTER_BEGIN_MARKER = "<!-- codex-onboarding:root-agents-pointer:start -->";
export const ROOT_AGENTS_POINTER_END_MARKER = "<!-- codex-onboarding:root-agents-pointer:end -->";

const ROOT_AGENTS_POINTER_BODY = [
  "## Codex Onboarding Extension Reference",
  "",
  "Read and follow `.codex-onboarding/INDEX.md` before planning or implementing changes.",
  "Treat `.codex-onboarding/core/` as extension-managed and use `.codex-onboarding/overrides/` for project-specific exceptions."
].join("\n");

export const ROOT_AGENTS_POINTER_SNIPPET = [
  ROOT_AGENTS_POINTER_BEGIN_MARKER,
  ROOT_AGENTS_POINTER_BODY,
  ROOT_AGENTS_POINTER_END_MARKER,
  ""
].join("\n");

export type RootAgentsPermission = "auto_create" | "allow_edit" | "deny_edit";

export interface RootAgentsInspection {
  exists: boolean;
  containsOnboardingReference: boolean;
  rootAgentsPath: string;
}

export type RootAgentsIntegrationStatus =
  | "created"
  | "updated"
  | "already_referenced"
  | "skipped_user_declined"
  | "write_failed";

export interface RootAgentsIntegrationResult {
  status: RootAgentsIntegrationStatus;
  rootAgentsPath: string;
  manualSnippet?: string;
  reason?: string;
}

export type RootAgentsCleanupStatus =
  | "removed"
  | "no_pointer_found"
  | "root_agents_missing"
  | "write_failed";

export interface RootAgentsCleanupResult {
  status: RootAgentsCleanupStatus;
  rootAgentsPath: string;
  reason?: string;
}

function ensureTrailingNewline(value: string): string {
  if (value.length === 0) {
    return "";
  }

  return value.endsWith("\n") ? value : `${value}\n`;
}

function buildNewRootAgentsFileContent(): string {
  return ["# AGENTS.md", "", ROOT_AGENTS_POINTER_SNIPPET].join("\n");
}

function hasOnboardingReference(content: string): boolean {
  return content.includes(ONBOARDING_INDEX_REFERENCE);
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeContentAfterRemoval(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  const compacted = normalized
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "");

  if (compacted.length === 0) {
    return compacted;
  }

  return compacted.endsWith("\n") ? compacted : `${compacted}\n`;
}

function stripRootAgentsPointer(content: string): { removed: boolean; nextContent: string } {
  let next = content;

  const markerPattern = new RegExp(
    `${escapeForRegex(ROOT_AGENTS_POINTER_BEGIN_MARKER)}[\\s\\S]*?${escapeForRegex(
      ROOT_AGENTS_POINTER_END_MARKER
    )}\\n?`,
    "g"
  );
  if (!markerPattern.test(next)) {
    return {
      removed: false,
      nextContent: content
    };
  }

  next = next.replace(markerPattern, "");

  return {
    removed: true,
    nextContent: normalizeContentAfterRemoval(next)
  };
}

export async function inspectRootAgentsIntegration(
  targetRootPath: string
): Promise<RootAgentsInspection> {
  const rootAgentsPath = path.join(targetRootPath, ROOT_AGENTS_RELATIVE_PATH);

  try {
    const content = await fs.readFile(rootAgentsPath, "utf8");
    return {
      exists: true,
      containsOnboardingReference: hasOnboardingReference(content),
      rootAgentsPath
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        exists: false,
        containsOnboardingReference: false,
        rootAgentsPath
      };
    }

    throw error;
  }
}

async function writeCreatedRootAgents(
  inspection: RootAgentsInspection,
  logger: RootAgentsLogger
): Promise<RootAgentsIntegrationResult> {
  try {
    await fs.writeFile(inspection.rootAgentsPath, buildNewRootAgentsFileContent(), "utf8");

    logger.log("debug", "root_agents_integrated", {
      root_agents_path: inspection.rootAgentsPath,
      integration_status: "created"
    });

    return {
      status: "created",
      rootAgentsPath: inspection.rootAgentsPath
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";
    logger.log("warning", "root_agents_integration_skipped", {
      root_agents_path: inspection.rootAgentsPath,
      integration_status: "write_failed",
      reason
    });

    return {
      status: "write_failed",
      rootAgentsPath: inspection.rootAgentsPath,
      manualSnippet: ROOT_AGENTS_POINTER_SNIPPET,
      reason
    };
  }
}

async function writeUpdatedRootAgents(
  inspection: RootAgentsInspection,
  logger: RootAgentsLogger
): Promise<RootAgentsIntegrationResult> {
  if (inspection.containsOnboardingReference) {
    logger.log("debug", "root_agents_integrated", {
      root_agents_path: inspection.rootAgentsPath,
      integration_status: "already_referenced"
    });

    return {
      status: "already_referenced",
      rootAgentsPath: inspection.rootAgentsPath
    };
  }

  try {
    const existingContent = await fs.readFile(inspection.rootAgentsPath, "utf8");
    const nextContent = `${ensureTrailingNewline(existingContent)}\n${ROOT_AGENTS_POINTER_SNIPPET}`;
    await fs.writeFile(inspection.rootAgentsPath, nextContent, "utf8");

    logger.log("debug", "root_agents_integrated", {
      root_agents_path: inspection.rootAgentsPath,
      integration_status: "updated"
    });

    return {
      status: "updated",
      rootAgentsPath: inspection.rootAgentsPath
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";
    logger.log("warning", "root_agents_integration_skipped", {
      root_agents_path: inspection.rootAgentsPath,
      integration_status: "write_failed",
      reason
    });

    return {
      status: "write_failed",
      rootAgentsPath: inspection.rootAgentsPath,
      manualSnippet: ROOT_AGENTS_POINTER_SNIPPET,
      reason
    };
  }
}

export async function applyRootAgentsIntegration(
  input: {
    inspection: RootAgentsInspection;
    permission: RootAgentsPermission;
  },
  logger: RootAgentsLogger
): Promise<RootAgentsIntegrationResult> {
  if (!input.inspection.exists) {
    return writeCreatedRootAgents(input.inspection, logger);
  }

  if (input.permission === "deny_edit") {
    logger.log("debug", "root_agents_integration_skipped", {
      root_agents_path: input.inspection.rootAgentsPath,
      integration_status: "skipped_user_declined"
    });

    return {
      status: "skipped_user_declined",
      rootAgentsPath: input.inspection.rootAgentsPath,
      manualSnippet: ROOT_AGENTS_POINTER_SNIPPET
    };
  }

  return writeUpdatedRootAgents(input.inspection, logger);
}

export async function removeRootAgentsIntegration(
  targetRootPath: string,
  logger: RootAgentsLogger
): Promise<RootAgentsCleanupResult> {
  const rootAgentsPath = path.join(targetRootPath, ROOT_AGENTS_RELATIVE_PATH);

  let content: string;
  try {
    content = await fs.readFile(rootAgentsPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.log("debug", "root_agents_cleanup", {
        root_agents_path: rootAgentsPath,
        cleanup_status: "root_agents_missing"
      });
      return {
        status: "root_agents_missing",
        rootAgentsPath
      };
    }

    const reason = error instanceof Error ? error.message : "unknown_error";
    logger.log("warning", "root_agents_cleanup", {
      root_agents_path: rootAgentsPath,
      cleanup_status: "write_failed",
      reason
    });
    return {
      status: "write_failed",
      rootAgentsPath,
      reason
    };
  }

  const stripResult = stripRootAgentsPointer(content);
  if (!stripResult.removed) {
    logger.log("debug", "root_agents_cleanup", {
      root_agents_path: rootAgentsPath,
      cleanup_status: "no_pointer_found"
    });
    return {
      status: "no_pointer_found",
      rootAgentsPath
    };
  }

  try {
    await fs.writeFile(rootAgentsPath, stripResult.nextContent, "utf8");
    logger.log("debug", "root_agents_cleanup", {
      root_agents_path: rootAgentsPath,
      cleanup_status: "removed"
    });
    return {
      status: "removed",
      rootAgentsPath
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";
    logger.log("warning", "root_agents_cleanup", {
      root_agents_path: rootAgentsPath,
      cleanup_status: "write_failed",
      reason
    });
    return {
      status: "write_failed",
      rootAgentsPath,
      reason
    };
  }
}
