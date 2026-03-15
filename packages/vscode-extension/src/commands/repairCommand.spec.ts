import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runRepair } from "./repairCommand";
import { applyGitTrackingMode, hasGitRepository } from "../services/gitTrackingService";
import { applyManagedInstall } from "../services/managedInstallService";
import { resolveTargetWorkspaceFolder } from "../services/workspaceRootResolver";

const { createTraceLoggerMock } = vi.hoisted(() => ({
  createTraceLoggerMock: vi.fn()
}));

vi.mock("../services/operationTraceLogger", () => ({
  OperationTraceLogger: {
    create: createTraceLoggerMock
  }
}));

vi.mock("../services/workspaceRootResolver", () => ({
  resolveTargetWorkspaceFolder: vi.fn()
}));

vi.mock("../services/managedInstallService", () => ({
  applyManagedInstall: vi.fn()
}));

vi.mock("../services/gitTrackingService", () => ({
  applyGitTrackingMode: vi.fn(),
  hasGitRepository: vi.fn()
}));

function buildContext(): vscode.ExtensionContext {
  return {
    extensionPath: "/tmp/ext",
    globalStorageUri: { fsPath: "/tmp/storage" },
    extension: {
      id: "publisher.extension",
      packageJSON: { version: "1.2.3" }
    }
  } as unknown as vscode.ExtensionContext;
}

function digestSha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

interface ManagedFixture {
  targetRoot: string;
  statePath: string;
}

async function createManagedFixture(options: {
  withState?: boolean;
  emptyState?: boolean;
  driftTrackedFile?: boolean;
  missingTrackedFile?: boolean;
  withManagedArtifacts?: boolean;
  corruptState?: boolean;
} = {}): Promise<ManagedFixture> {
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repair-command-test-"));
  const onboardingRoot = path.join(targetRoot, ".codex-onboarding");
  const managedRoot = path.join(onboardingRoot, ".managed");
  const topicPath = path.join(
    onboardingRoot,
    "core",
    "topics",
    "cross-cutting",
    "base-topic.md"
  );
  const bootstrapPath = path.join(onboardingRoot, "AGENTS.md");
  const statePath = path.join(managedRoot, "state.json");
  const withManagedArtifacts = options.withManagedArtifacts !== false;

  if (withManagedArtifacts) {
    await fs.mkdir(path.dirname(topicPath), { recursive: true });
    await fs.mkdir(path.dirname(bootstrapPath), { recursive: true });
    await fs.mkdir(managedRoot, { recursive: true });
  }

  const bootstrapContent = [
    "<!--",
    "artifact_id: core-agent-onboarding",
    "managed: true",
    "schema_version: 1",
    "bundle_id: dotnet-csharp-web-api-simple",
    "bundle_version: 1",
    "extension_version: 0.0.1",
    "-->",
    "",
    "# AGENTS"
  ].join("\n");
  const topicContent = [
    "<!--",
    "artifact_id: base-topic",
    "managed: true",
    "schema_version: 1",
    "bundle_id: dotnet-csharp-web-api-simple",
    "bundle_version: 1",
    "extension_version: 0.0.1",
    "-->",
    "",
    "# Base Topic"
  ].join("\n");

  if (withManagedArtifacts) {
    await fs.writeFile(bootstrapPath, bootstrapContent, "utf8");
    await fs.writeFile(topicPath, topicContent, "utf8");
  }

  if (withManagedArtifacts && options.corruptState) {
    await fs.writeFile(statePath, "{ invalid", "utf8");
  } else if (options.withState !== false) {
    const managedFiles = options.emptyState
      ? []
      : [
          {
            file_id: "core-agent-onboarding",
            relative_path: ".codex-onboarding/AGENTS.md",
            content_digest_sha256: digestSha256(bootstrapContent),
            sync_marker: "1|0.0.1",
            metadata_mode: "embedded",
            metadata_format: "comment_block"
          },
          {
            file_id: "base-topic",
            relative_path: ".codex-onboarding/core/topics/cross-cutting/base-topic.md",
            content_digest_sha256: digestSha256(topicContent),
            sync_marker: "1|0.0.1",
            metadata_mode: "embedded",
            metadata_format: "comment_block"
          }
        ];

    await fs.writeFile(
      statePath,
      JSON.stringify(
        {
          bundle_id: "dotnet-csharp-web-api-simple",
          bundle_version: "1",
          extension_version: "0.0.1",
          applied_at_utc: new Date().toISOString(),
          managed_files: managedFiles
        },
        null,
        2
      ),
      "utf8"
    );
  }

  if (options.driftTrackedFile) {
    await fs.appendFile(topicPath, "\n# user edit", "utf8");
  }

  if (options.missingTrackedFile) {
    await fs.rm(topicPath, { force: true });
  }

  return {
    targetRoot,
    statePath
  };
}

describe("runRepair", () => {
  const cleanupRoots: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();

    createTraceLoggerMock.mockResolvedValue({
      log: vi.fn(),
      flush: vi.fn(),
      logFilePath: "/tmp/storage/operation-logs/repair-log.jsonl"
    });

    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

    vi.mocked(hasGitRepository).mockResolvedValue(true);
    vi.mocked(applyGitTrackingMode).mockResolvedValue({
      mode: "track",
      strategy: "git_info_exclude",
      updated: true,
      excludePath: "/tmp/project/.git/info/exclude"
    });
    vi.mocked(applyManagedInstall).mockResolvedValue({
      statePath: "/tmp/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/tmp/project/.codex-onboarding/.managed",
      appliedFiles: [".codex-onboarding/AGENTS.md"],
      skippedFiles: [],
      recoveredTrackedFiles: [],
      removedStaleFiles: []
    });
  });

  afterEach(async () => {
    while (cleanupRoots.length > 0) {
      const root = cleanupRoots.pop();
      if (root) {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  });

  it("blocks when no workspace folder is available", async () => {
    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue(undefined);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No workspace folder is available for repair operation."
    );
    expect(hasGitRepository).not.toHaveBeenCalled();
    expect(applyManagedInstall).not.toHaveBeenCalled();
  });

  it("blocks when prior install evidence (state) is missing", async () => {
    const fixture = await createManagedFixture({ withState: false, withManagedArtifacts: false });
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No existing managed onboarding artifacts were found in this workspace. Run Install first."
    );
    expect(hasGitRepository).not.toHaveBeenCalled();
    expect(applyManagedInstall).not.toHaveBeenCalled();
  });

  it("recovers repair source when state file is missing but managed artifacts exist", async () => {
    const fixture = await createManagedFixture({ withState: false });
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        mode: "repair"
      }),
      expect.any(Object)
    );
  });

  it("recovers repair source when state file is corrupt but managed artifacts exist", async () => {
    const fixture = await createManagedFixture({ corruptState: true });
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        mode: "repair"
      }),
      expect.any(Object)
    );
  });

  it("recovers repair source when state exists but managed file list is empty", async () => {
    const fixture = await createManagedFixture({ emptyState: true });
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRootPath: fixture.targetRoot,
        mode: "repair"
      }),
      expect.any(Object)
    );
  });

  it("runs state-driven repair without drift confirmation when managed files are unchanged", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        mode: "repair",
        forceResetModifiedManagedFiles: false
      }),
      expect.any(Object)
    );
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("Repair operation completed.")
    );
  });

  it("shows drift warning QuickPick and cancels when user declines reset", async () => {
    const fixture = await createManagedFixture({ driftTrackedFile: true });
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Cancel Repair",
      value: "cancel"
    } as any);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Repair canceled.");
  });

  it("resets drifted managed files after explicit user confirmation", async () => {
    const fixture = await createManagedFixture({ driftTrackedFile: true, missingTrackedFile: true });
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick")
      .mockResolvedValueOnce({
        label: "Reset Managed Files (Discard Local Changes)",
        value: "reset"
      } as any)
      .mockResolvedValueOnce({
        label: "Track managed files (Recommended)",
        value: "track"
      } as any);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRootPath: fixture.targetRoot,
        mode: "repair",
        forceResetModifiedManagedFiles: true
      }),
      expect.any(Object)
    );
  });

  it("skips git question when selected root has no git repository", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.mocked(hasGitRepository).mockResolvedValue(false);

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(0);
    expect(applyGitTrackingMode).toHaveBeenCalledWith(
      {
        targetRootPath: fixture.targetRoot,
        mode: "track"
      },
      expect.any(Object)
    );
  });

  it("shows error message when repair apply fails", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);
    vi.mocked(applyManagedInstall).mockRejectedValue(new Error("repair boom"));

    await runRepair(buildContext(), { log: vi.fn() } as any);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Repair failed: repair boom");
  });
});
