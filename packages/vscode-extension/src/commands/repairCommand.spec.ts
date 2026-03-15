import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runRepair } from "./repairCommand";
import { applyGitTrackingMode, hasGitRepository } from "../services/gitTrackingService";
import { applyManagedInstall } from "../services/managedInstallService";
import { mirrorOperationLogToProject } from "../services/projectOperationLogService";
import { removeRootAgentsIntegration } from "../services/rootAgentsIntegrationService";
import { resolveTargetWorkspaceFolder } from "../services/workspaceRootResolver";

const { createTraceLoggerMock, mirrorOperationLogToProjectMock } = vi.hoisted(() => ({
  createTraceLoggerMock: vi.fn(),
  mirrorOperationLogToProjectMock: vi.fn()
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

vi.mock("../services/projectOperationLogService", () => ({
  buildProjectOperationLogPath: vi.fn((targetRootPath: string, sourceLogPath: string) =>
    path.join(targetRootPath, ".codex-onboarding", ".managed", "logs", path.basename(sourceLogPath))
  ),
  mirrorOperationLogToProject: mirrorOperationLogToProjectMock
}));

vi.mock("../services/rootAgentsIntegrationService", () => ({
  removeRootAgentsIntegration: vi.fn()
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
    vi.mocked(removeRootAgentsIntegration).mockResolvedValue({
      status: "removed",
      rootAgentsPath: "/tmp/project/AGENTS.md"
    });
    vi.mocked(mirrorOperationLogToProject).mockResolvedValue(
      "/tmp/project/.codex-onboarding/.managed/logs/repair-log.jsonl"
    );
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

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No workspace folder is available for repair operation."
    );
    expect(hasGitRepository).not.toHaveBeenCalled();
    expect(applyManagedInstall).not.toHaveBeenCalled();
  });

  it("cancels repair at installation scope when workspace picker is dismissed", async () => {
    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue(undefined);
    (vscode.workspace as unknown as { workspaceFolders: vscode.WorkspaceFolder[] }).workspaceFolders = [
      { name: "project", uri: { fsPath: "/workspace/project" } } as unknown as vscode.WorkspaceFolder
    ];

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "Repair canceled at Installation Scope."
    );

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith("warning", "operation_blocked", {
      reason: "target_scope_cancelled"
    });

    (vscode.workspace as unknown as { workspaceFolders: vscode.WorkspaceFolder[] | undefined }).workspaceFolders =
      undefined;
  });

  it("blocks when prior install evidence (state) is missing", async () => {
    const fixture = await createManagedFixture({ withState: false, withManagedArtifacts: false });
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No existing managed onboarding artifacts were found in this workspace. Run Install first."
    );
    expect(hasGitRepository).not.toHaveBeenCalled();
    expect(applyManagedInstall).not.toHaveBeenCalled();
  });

  it("treats invalid state shape as corrupt and blocks when no managed artifacts are recoverable", async () => {
    const fixture = await createManagedFixture({ withManagedArtifacts: false, withState: false });
    cleanupRoots.push(fixture.targetRoot);

    const managedRoot = path.join(fixture.targetRoot, ".codex-onboarding", ".managed");
    await fs.mkdir(managedRoot, { recursive: true });
    await fs.writeFile(
      path.join(managedRoot, "state.json"),
      JSON.stringify({ managed_files: "invalid" }),
      "utf8"
    );

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No existing managed onboarding artifacts were found in this workspace. Run Install first."
    );
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

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

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

  it("blocks recovery when bootstrap metadata is missing", async () => {
    const fixture = await createManagedFixture({ withState: false });
    cleanupRoots.push(fixture.targetRoot);

    await fs.writeFile(
      path.join(fixture.targetRoot, ".codex-onboarding", "AGENTS.md"),
      "# Not managed metadata",
      "utf8"
    );

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No existing managed onboarding artifacts were found in this workspace. Run Install first."
    );
  });

  it("blocks recovery when bootstrap managed metadata is incomplete", async () => {
    const fixture = await createManagedFixture({ withState: false });
    cleanupRoots.push(fixture.targetRoot);

    await fs.writeFile(
      path.join(fixture.targetRoot, ".codex-onboarding", "AGENTS.md"),
      [
        "<!--",
        "artifact_id: core-agent-onboarding",
        "managed: true",
        "bundle_id: dotnet-csharp-web-api-simple",
        "bundle_version: 1",
        "-->",
        "",
        "# AGENTS"
      ].join("\n"),
      "utf8"
    );

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No existing managed onboarding artifacts were found in this workspace. Run Install first."
    );
    expect(applyManagedInstall).not.toHaveBeenCalled();
  });

  it("surfaces recovery bootstrap read permission errors", async () => {
    const fixture = await createManagedFixture({ withState: false });
    cleanupRoots.push(fixture.targetRoot);

    const bootstrapPath = path.join(fixture.targetRoot, ".codex-onboarding", "AGENTS.md");
    await fs.chmod(bootstrapPath, 0o000);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringMatching(/^Repair failed:/)
    );
    await fs.chmod(bootstrapPath, 0o644);
  });

  it("recovers with zero topics when topic files are present but not managed", async () => {
    const fixture = await createManagedFixture({ withState: false });
    cleanupRoots.push(fixture.targetRoot);

    await fs.writeFile(
      path.join(
        fixture.targetRoot,
        ".codex-onboarding",
        "core",
        "topics",
        "cross-cutting",
        "base-topic.md"
      ),
      "# user topic without metadata",
      "utf8"
    );

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRootPath: fixture.targetRoot,
        selectedTopics: []
      }),
      expect.any(Object)
    );
  });

  it("recovers when topics directory is absent", async () => {
    const fixture = await createManagedFixture({ withManagedArtifacts: false, withState: false });
    cleanupRoots.push(fixture.targetRoot);

    await fs.mkdir(path.join(fixture.targetRoot, ".codex-onboarding"), { recursive: true });
    await fs.writeFile(
      path.join(fixture.targetRoot, ".codex-onboarding", "AGENTS.md"),
      [
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
      ].join("\n"),
      "utf8"
    );

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRootPath: fixture.targetRoot,
        selectedTopics: []
      }),
      expect.any(Object)
    );
  });

  it("recovers sorted topics and ignores non-file directory entries", async () => {
    const fixture = await createManagedFixture({ withState: false });
    cleanupRoots.push(fixture.targetRoot);

    const secondTopicPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding",
      "core",
      "topics",
      "cross-cutting",
      "z-topic.md"
    );
    const secondTopicContent = [
      "<!--",
      "artifact_id: z-topic",
      "managed: true",
      "schema_version: 1",
      "bundle_id: dotnet-csharp-web-api-simple",
      "bundle_version: 1",
      "extension_version: 0.0.1",
      "-->",
      "",
      "# z-topic"
    ].join("\n");
    await fs.writeFile(secondTopicPath, secondTopicContent, "utf8");

    const symlinkPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding",
      "core",
      "topics",
      "cross-cutting",
      "link-entry"
    );
    await fs.symlink(secondTopicPath, symlinkPath);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedTopics: expect.arrayContaining([
          expect.objectContaining({ path: "topics/cross-cutting/base-topic.md" }),
          expect.objectContaining({ path: "topics/cross-cutting/z-topic.md" })
        ])
      }),
      expect.any(Object)
    );
  });

  it("surfaces recovery topic-scan permission errors", async () => {
    const fixture = await createManagedFixture({ withState: false });
    cleanupRoots.push(fixture.targetRoot);

    const topicsRoot = path.join(
      fixture.targetRoot,
      ".codex-onboarding",
      "core",
      "topics"
    );
    await fs.chmod(topicsRoot, 0o000);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringMatching(/^Repair failed:/)
    );
    await fs.chmod(topicsRoot, 0o755);
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

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

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

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

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
    const logger = { log: vi.fn(), show: vi.fn() };

    await runRepair(buildContext(), logger as any);

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
    expect(removeRootAgentsIntegration).toHaveBeenCalledWith(
      fixture.targetRoot,
      expect.any(Object)
    );
    expect(logger.show).not.toHaveBeenCalled();
  });

  it("builds sorted selected topics from managed state entries", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);

    const extraTopicPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding",
      "core",
      "topics",
      "cross-cutting",
      "a-topic.md"
    );
    const extraTopicContent = [
      "<!--",
      "artifact_id: a-topic",
      "managed: true",
      "schema_version: 1",
      "bundle_id: dotnet-csharp-web-api-simple",
      "bundle_version: 1",
      "extension_version: 0.0.1",
      "-->",
      "",
      "# A Topic"
    ].join("\n");
    await fs.mkdir(path.dirname(extraTopicPath), { recursive: true });
    await fs.writeFile(extraTopicPath, extraTopicContent, "utf8");

    const rawState = await fs.readFile(fixture.statePath, "utf8");
    const parsedState = JSON.parse(rawState) as {
      managed_files: Array<{
        file_id: string;
        relative_path: string;
        content_digest_sha256: string;
        sync_marker: string;
        metadata_mode: string;
        metadata_format: string;
      }>;
    };
    parsedState.managed_files.push({
      file_id: "a-topic",
      relative_path: ".codex-onboarding/core/topics/cross-cutting/a-topic.md",
      content_digest_sha256: digestSha256(extraTopicContent),
      sync_marker: "1|0.0.1",
      metadata_mode: "embedded",
      metadata_format: "comment_block"
    });
    await fs.writeFile(fixture.statePath, JSON.stringify(parsedState, null, 2), "utf8");

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedTopics: [
          expect.objectContaining({
            path: "topics/cross-cutting/a-topic.md"
          }),
          expect.objectContaining({
            path: "topics/cross-cutting/base-topic.md"
          })
        ]
      }),
      expect.any(Object)
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

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Repair canceled.");
  });

  it("surfaces non-ENOENT drift scan read errors", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);

    const topicPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding",
      "core",
      "topics",
      "cross-cutting",
      "base-topic.md"
    );
    await fs.chmod(topicPath, 0o000);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    const logger = { log: vi.fn(), show: vi.fn() };

    await runRepair(buildContext(), logger as any);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringMatching(/^Repair failed:/)
    );
    expect(logger.show).toHaveBeenCalledTimes(1);
    await fs.chmod(topicPath, 0o644);
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

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRootPath: fixture.targetRoot,
        mode: "repair",
        forceResetModifiedManagedFiles: true
      }),
      expect.any(Object)
    );
  });

  it("blocks when repair options selection is cancelled", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "Repair canceled at Repair Options."
    );
  });

  it("blocks when recovery metadata is inconsistent", async () => {
    const fixture = await createManagedFixture({ withState: false });
    cleanupRoots.push(fixture.targetRoot);

    const topicPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding",
      "core",
      "topics",
      "cross-cutting",
      "base-topic.md"
    );
    const topicWithMismatch = [
      "<!--",
      "artifact_id: base-topic",
      "managed: true",
      "schema_version: 1",
      "bundle_id: other-bundle",
      "bundle_version: 1",
      "extension_version: 0.0.1",
      "-->",
      "",
      "# Base Topic"
    ].join("\n");
    await fs.writeFile(topicPath, topicWithMismatch, "utf8");

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(applyManagedInstall).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "No existing managed onboarding artifacts were found in this workspace. Run Install first."
    );
  });

  it("skips git question when selected root has no git repository", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.mocked(hasGitRepository).mockResolvedValue(false);

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(0);
    expect(applyGitTrackingMode).toHaveBeenCalledWith(
      {
        targetRootPath: fixture.targetRoot,
        mode: "track"
      },
      expect.any(Object)
    );
  });

  it("warns when git tracking apply reports non-git root", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Ignore managed files in local Git metadata",
      value: "ignore"
    } as any);
    vi.mocked(applyGitTrackingMode).mockResolvedValue({
      mode: "ignore",
      strategy: "no_git_repository",
      updated: false
    });

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "Selected workspace root is not a Git repository. Git tracking preference was skipped."
    );
  });

  it("includes applied artifacts report path in repair summary when present", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);
    vi.mocked(applyManagedInstall).mockResolvedValue({
      statePath: "/tmp/project/.codex-onboarding/.managed/state.json",
      managedRootPath: "/tmp/project/.codex-onboarding/.managed",
      appliedArtifactsReportPath: "/tmp/project/.codex-onboarding/.managed/applied-artifacts.md",
      appliedFiles: [".codex-onboarding/AGENTS.md"],
      skippedFiles: [],
      recoveredTrackedFiles: [],
      removedStaleFiles: []
    });

    await runRepair(buildContext(), { log: vi.fn(), show: vi.fn() } as any);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("Applied artifacts report: /tmp/project/.codex-onboarding/.managed/applied-artifacts.md")
    );
  });

  it("logs mirror warning when project log mirroring fails", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);
    const logger = { log: vi.fn(), show: vi.fn() };

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);
    vi.mocked(mirrorOperationLogToProject).mockRejectedValue(new Error("mirror failed"));

    await runRepair(buildContext(), logger as any);

    expect(logger.log).toHaveBeenCalledWith(
      "warning",
      "operation_log_mirror_failed",
      expect.objectContaining({
        command: "repair",
        target_root: fixture.targetRoot,
        reason: "mirror failed"
      })
    );
  });

  it("logs mirror warning with unknown reason when mirroring fails with non-Error", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);
    const logger = { log: vi.fn(), show: vi.fn() };

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);
    vi.mocked(mirrorOperationLogToProject).mockRejectedValue("mirror boom");

    await runRepair(buildContext(), logger as any);

    expect(logger.log).toHaveBeenCalledWith(
      "warning",
      "operation_log_mirror_failed",
      expect.objectContaining({
        command: "repair",
        target_root: fixture.targetRoot,
        reason: "unknown_error"
      })
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
    const logger = { log: vi.fn(), show: vi.fn() };

    await runRepair(buildContext(), logger as any);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Repair failed: repair boom");
    expect(logger.show).toHaveBeenCalledTimes(1);
  });

  it("logs unknown reason when repair apply throws non-Error value with active trace logger", async () => {
    const fixture = await createManagedFixture();
    cleanupRoots.push(fixture.targetRoot);

    vi.mocked(resolveTargetWorkspaceFolder).mockResolvedValue({
      uri: { fsPath: fixture.targetRoot }
    } as unknown as vscode.WorkspaceFolder);
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue({
      label: "Track managed files (Recommended)",
      value: "track"
    } as any);
    vi.mocked(applyManagedInstall).mockRejectedValue("repair-bang");
    const logger = { log: vi.fn(), show: vi.fn() };

    await runRepair(buildContext(), logger as any);

    const trace = await createTraceLoggerMock.mock.results[0]?.value;
    expect(trace.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({ result_code: "failed", reason: "unknown_error" })
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Repair failed: unknown error");
  });

  it("falls back to output logger when trace logger cannot be created", async () => {
    createTraceLoggerMock.mockRejectedValue("trace-create-failed");
    const logger = { log: vi.fn(), show: vi.fn() };

    await runRepair(buildContext(), logger as any);

    expect(logger.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({
        command: "repair",
        result_code: "failed",
        reason: "unknown_error"
      })
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Repair failed: unknown error");
    expect(logger.show).toHaveBeenCalledTimes(1);
  });

  it("falls back to output logger with explicit message when trace logger creation throws Error", async () => {
    createTraceLoggerMock.mockRejectedValue(new Error("trace init failed"));
    const logger = { log: vi.fn(), show: vi.fn() };

    await runRepair(buildContext(), logger as any);

    expect(logger.log).toHaveBeenCalledWith(
      "error",
      "operation_completed",
      expect.objectContaining({
        command: "repair",
        result_code: "failed",
        reason: "trace init failed"
      })
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Repair failed: trace init failed");
    expect(logger.show).toHaveBeenCalledTimes(1);
  });
});
