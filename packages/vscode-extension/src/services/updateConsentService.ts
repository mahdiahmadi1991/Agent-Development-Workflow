import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as vscode from "vscode";

import { ManagedState } from "../contracts/managedState";
import { LogLevel, LogValue } from "./outputLogger";

interface UpdateConsentLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

export interface UpdateConsentInput {
  command: "install" | "repair";
  targetRootPath: string;
  bundleId: string;
  bundleVersion: string;
  extensionVersion: string;
  repositoryUrl?: string;
}

export interface UpdateConsentResult {
  updateAvailable: boolean;
  blocked: boolean;
  reason:
    | "no_managed_state"
    | "already_synchronized"
    | "update_consent_granted"
    | "update_consent_declined"
    | "state_unreadable";
  releaseNotesUrl?: string;
  changelogUrl?: string;
}

interface ManagedStateDiff {
  bundleChanged: boolean;
  extensionChanged: boolean;
}

const FALLBACK_REPOSITORY_URL = "https://github.com/mahdiahmadi1991/Codex-Onboarding-Workflow";

function parseState(raw: string): ManagedState {
  const parsed = JSON.parse(raw) as ManagedState;

  if (!Array.isArray(parsed.managed_files)) {
    throw new Error("Managed state is invalid: managed_files must be an array.");
  }

  return parsed;
}

async function readExistingState(targetRootPath: string): Promise<ManagedState | undefined> {
  const statePath = path.join(targetRootPath, ".codex-onboarding", ".managed", "state.json");

  try {
    const raw = await fs.readFile(statePath, "utf8");
    return parseState(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function normalizeRepositoryUrl(value?: string): string {
  const raw = (value ?? "").trim();
  if (!raw) {
    return FALLBACK_REPOSITORY_URL;
  }

  const noGitPlus = raw.replace(/^git\+/, "");
  const sshMatch = /^git@github\.com:(.+?)(?:\.git)?$/i.exec(noGitPlus);
  if (sshMatch?.[1]) {
    return `https://github.com/${sshMatch[1]}`;
  }

  return noGitPlus.replace(/\.git$/i, "");
}

function buildReleaseDocumentationUrls(repositoryUrl: string, extensionVersion: string): {
  releaseNotesUrl: string;
  changelogUrl: string;
} {
  const repoBase = normalizeRepositoryUrl(repositoryUrl);
  return {
    releaseNotesUrl: `${repoBase}/blob/main/docs/releases/v${extensionVersion}.md`,
    changelogUrl: `${repoBase}/blob/main/CHANGELOG.md`
  };
}

function calculateDiff(input: UpdateConsentInput, state: ManagedState): ManagedStateDiff {
  return {
    bundleChanged:
      state.bundle_id !== input.bundleId || state.bundle_version !== input.bundleVersion,
    extensionChanged: state.extension_version !== input.extensionVersion
  };
}

async function openExternalUrl(url: string): Promise<boolean> {
  try {
    return await vscode.env.openExternal(vscode.Uri.parse(url));
  } catch {
    return false;
  }
}

async function askUpdateConsent(input: {
  command: "install" | "repair";
  currentBundleId: string;
  currentBundleVersion: string;
  currentExtensionVersion: string;
  nextBundleId: string;
  nextBundleVersion: string;
  nextExtensionVersion: string;
  releaseNotesUrl: string;
  changelogUrl: string;
  logger: UpdateConsentLogger;
}): Promise<boolean> {
  let releaseNotesOpened = false;
  let changelogOpened = false;

  while (true) {
    const detail = [
      "Update is available for managed onboarding files.",
      "",
      "Current state:",
      `- Bundle: ${input.currentBundleId}@${input.currentBundleVersion}`,
      `- Extension: ${input.currentExtensionVersion}`,
      "",
      "Target state:",
      `- Bundle: ${input.nextBundleId}@${input.nextBundleVersion}`,
      `- Extension: ${input.nextExtensionVersion}`,
      "",
      `- Release Notes reviewed: ${releaseNotesOpened ? "yes" : "no"}`,
      `- Changelog reviewed: ${changelogOpened ? "yes" : "no"}`
    ].join("\n");

    const decision = await vscode.window.showInformationMessage(
      "Update Review Required: release notes and changelog must be reviewed before apply.",
      { modal: true, detail },
      "Open Release Notes",
      "Open Changelog",
      "Continue Update",
      "Cancel Update"
    );

    if (decision === "Open Release Notes") {
      const opened = await openExternalUrl(input.releaseNotesUrl);
      if (opened) {
        releaseNotesOpened = true;
        input.logger.log("debug", "update_doc_opened", {
          command: input.command,
          doc: "release_notes"
        });
      } else {
        void vscode.window.showWarningMessage("Release notes could not be opened.");
      }
      continue;
    }

    if (decision === "Open Changelog") {
      const opened = await openExternalUrl(input.changelogUrl);
      if (opened) {
        changelogOpened = true;
        input.logger.log("debug", "update_doc_opened", {
          command: input.command,
          doc: "changelog"
        });
      } else {
        void vscode.window.showWarningMessage("Changelog could not be opened.");
      }
      continue;
    }

    if (decision === "Continue Update") {
      if (releaseNotesOpened && changelogOpened) {
        return true;
      }

      void vscode.window.showWarningMessage(
        "Review both Release Notes and Changelog before continuing update."
      );
      continue;
    }

    return false;
  }
}

export async function requireUpdateConsentIfNeeded(
  input: UpdateConsentInput,
  logger: UpdateConsentLogger
): Promise<UpdateConsentResult> {
  logger.log("debug", "update_check_started", {
    command: input.command,
    target_root: input.targetRootPath
  });

  let state: ManagedState | undefined;
  try {
    state = await readExistingState(input.targetRootPath);
  } catch (error) {
    logger.log("warning", "update_check_skipped", {
      command: input.command,
      reason: "state_unreadable",
      message: error instanceof Error ? error.message : "unknown_error"
    });

    return {
      updateAvailable: false,
      blocked: false,
      reason: "state_unreadable"
    };
  }

  if (!state) {
    logger.log("debug", "update_check_completed", {
      command: input.command,
      reason: "no_managed_state"
    });
    return {
      updateAvailable: false,
      blocked: false,
      reason: "no_managed_state"
    };
  }

  const diff = calculateDiff(input, state);
  const updateAvailable = diff.bundleChanged || diff.extensionChanged;

  if (!updateAvailable) {
    logger.log("debug", "update_check_completed", {
      command: input.command,
      reason: "already_synchronized"
    });
    return {
      updateAvailable: false,
      blocked: false,
      reason: "already_synchronized"
    };
  }

  const { releaseNotesUrl, changelogUrl } = buildReleaseDocumentationUrls(
    input.repositoryUrl ?? FALLBACK_REPOSITORY_URL,
    input.extensionVersion
  );

  logger.log("debug", "update_available", {
    command: input.command,
    current_bundle_id: state.bundle_id,
    current_bundle_version: state.bundle_version,
    current_extension_version: state.extension_version,
    next_bundle_id: input.bundleId,
    next_bundle_version: input.bundleVersion,
    next_extension_version: input.extensionVersion,
    release_notes_url: releaseNotesUrl,
    changelog_url: changelogUrl
  });

  const consentGranted = await askUpdateConsent({
    command: input.command,
    currentBundleId: state.bundle_id,
    currentBundleVersion: state.bundle_version,
    currentExtensionVersion: state.extension_version,
    nextBundleId: input.bundleId,
    nextBundleVersion: input.bundleVersion,
    nextExtensionVersion: input.extensionVersion,
    releaseNotesUrl,
    changelogUrl,
    logger
  });

  if (!consentGranted) {
    logger.log("warning", "operation_blocked", {
      command: input.command,
      reason: "update_consent_declined"
    });
    return {
      updateAvailable: true,
      blocked: true,
      reason: "update_consent_declined",
      releaseNotesUrl,
      changelogUrl
    };
  }

  logger.log("debug", "update_check_completed", {
    command: input.command,
    reason: "update_consent_granted"
  });

  return {
    updateAvailable: true,
    blocked: false,
    reason: "update_consent_granted",
    releaseNotesUrl,
    changelogUrl
  };
}
