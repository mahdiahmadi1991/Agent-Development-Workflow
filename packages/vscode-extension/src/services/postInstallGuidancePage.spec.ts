import * as vscode from "vscode";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  COPY_STARTER_PROMPT_COMMAND,
  OPEN_MANAGED_ROOT_COMMAND,
  OPEN_OPERATION_LOG_COMMAND,
  POST_INSTALL_PANEL_TITLE,
  POST_INSTALL_PANEL_VIEW_TYPE,
  openPostInstallGuidancePage
} from "./postInstallGuidancePage";

describe("openPostInstallGuidancePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders V1 post-install WebviewPanel with required sections and actions", async () => {
    const panel = {
      webview: {
        html: ""
      }
    } as any;

    const createPanelSpy = vi.spyOn(vscode.window, "createWebviewPanel").mockReturnValue(panel);

    const opened = await openPostInstallGuidancePage({
      targetRootPath: "/workspace/project",
      selectedProfile: "dotnet-csharp-web-api-simple",
      logFilePath: "/tmp/storage/operation-logs/install-log.jsonl",
      managedStatePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      gitMode: "ignore",
      gitTrackingStrategy: "git_info_exclude",
      gitTrackingUpdated: true,
      appliedCount: 3,
      skippedCount: 1,
      removedStaleCount: 2,
      extensionVersion: "1.2.3",
      bundleId: "dotnet-csharp-web-api-simple",
      bundleVersion: "7",
      capabilityTags: ["cap.base", "answer.root.web_api_simple"],
      operationId: "install-123"
    });

    expect(opened).toBe(true);
    expect(createPanelSpy).toHaveBeenCalledWith(
      POST_INSTALL_PANEL_VIEW_TYPE,
      POST_INSTALL_PANEL_TITLE,
      expect.anything(),
      expect.objectContaining({
        enableScripts: false,
        enableCommandUris: true
      })
    );

    expect(panel.webview.html).toContain("Content-Security-Policy");
    expect(panel.webview.html).toContain("Outcome Snapshot");
    expect(panel.webview.html).toContain("Before/After Map");
    expect(panel.webview.html).toContain("Git Tracking Details");
    expect(panel.webview.html).toContain("First 3 Steps");
    expect(panel.webview.html).toContain("Prompt Packs");
    expect(panel.webview.html).toContain("Safe Boundaries");
    expect(panel.webview.html).toContain("Lifecycle Playbook");
    expect(panel.webview.html).toContain("Change Report");

    expect(panel.webview.html).toContain("Open Managed Root");
    expect(panel.webview.html).toContain("Open Operation Log");
    expect(panel.webview.html).toContain("Run Repair");
    expect(panel.webview.html).toContain("Run Remove");
    expect(panel.webview.html).toContain("command:" + OPEN_MANAGED_ROOT_COMMAND);
    expect(panel.webview.html).toContain("command:" + OPEN_OPERATION_LOG_COMMAND);
    expect(panel.webview.html).toContain("command:codexOnboarding.repair");
    expect(panel.webview.html).toContain("command:codexOnboarding.remove");

    expect(panel.webview.html).toContain("command:" + COPY_STARTER_PROMPT_COMMAND);
    expect(panel.webview.html).toContain("ISSUE-REPORTING.md");

    expect(panel.webview.html).toContain("Discover");
    expect(panel.webview.html).toContain("Implement");
    expect(panel.webview.html).toContain("Validate");

    expect(panel.webview.html).toContain("/workspace/project/.codex-onboarding/.managed/state.json");
    expect(panel.webview.html).toContain("/tmp/storage/operation-logs/install-log.jsonl");
    expect(panel.webview.html).toContain(".git/info/exclude");
    expect(panel.webview.html).toContain("To exit ignore mode");

    const html = panel.webview.html;
    const actionBarIndex = html.indexOf("action-bar");
    const outcomeIndex = html.indexOf("Outcome Snapshot");
    const beforeAfterIndex = html.indexOf("Before/After Map");
    const gitTrackingDetailsIndex = html.indexOf("Git Tracking Details");
    const firstStepsIndex = html.indexOf("First 3 Steps");
    const promptPacksIndex = html.indexOf("Prompt Packs");
    const safeBoundariesIndex = html.indexOf("Safe Boundaries");
    const lifecycleIndex = html.indexOf("Lifecycle Playbook");
    const changeReportIndex = html.indexOf("Change Report");

    expect(actionBarIndex).toBeGreaterThanOrEqual(0);
    expect(actionBarIndex).toBeLessThan(outcomeIndex);
    expect(outcomeIndex).toBeLessThan(beforeAfterIndex);
    expect(beforeAfterIndex).toBeLessThan(gitTrackingDetailsIndex);
    expect(gitTrackingDetailsIndex).toBeLessThan(firstStepsIndex);
    expect(firstStepsIndex).toBeLessThan(promptPacksIndex);
    expect(promptPacksIndex).toBeLessThan(safeBoundariesIndex);
    expect(safeBoundariesIndex).toBeLessThan(lifecycleIndex);
    expect(lifecycleIndex).toBeLessThan(changeReportIndex);
  });

  it("returns false and shows warning when WebviewPanel cannot be created", async () => {
    vi.spyOn(vscode.window, "createWebviewPanel").mockImplementation(() => {
      throw new Error("panel create failed");
    });

    const warningSpy = vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);

    const opened = await openPostInstallGuidancePage({
      targetRootPath: "/workspace/project",
      selectedProfile: "dotnet-csharp-web-api-simple",
      logFilePath: "/tmp/storage/operation-logs/install-log.jsonl",
      managedStatePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      gitMode: "track",
      gitTrackingStrategy: "git_info_exclude",
      gitTrackingUpdated: false,
      appliedCount: 3,
      skippedCount: 1,
      removedStaleCount: 2,
      extensionVersion: "1.2.3",
      bundleId: "dotnet-csharp-web-api-simple",
      bundleVersion: "7",
      capabilityTags: [],
      operationId: "install-123"
    });

    expect(opened).toBe(false);
    expect(warningSpy).toHaveBeenCalledWith(
      "Install completed, but the post-install guidance panel could not be opened."
    );
  });

  it("does not render git-tracking details when git strategy is not ignore-applied", async () => {
    const panel = {
      webview: {
        html: ""
      }
    } as any;

    vi.spyOn(vscode.window, "createWebviewPanel").mockReturnValue(panel);

    const opened = await openPostInstallGuidancePage({
      targetRootPath: "/workspace/project",
      selectedProfile: "dotnet-csharp-web-api-simple",
      logFilePath: "/tmp/storage/operation-logs/install-log.jsonl",
      managedStatePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      gitMode: "track",
      gitTrackingStrategy: "no_git_repository",
      gitTrackingUpdated: false,
      appliedCount: 1,
      skippedCount: 0,
      removedStaleCount: 0,
      extensionVersion: "1.2.3",
      bundleId: "dotnet-csharp-web-api-simple",
      bundleVersion: "7",
      capabilityTags: [],
      operationId: "install-123"
    });

    expect(opened).toBe(true);
    expect(panel.webview.html).not.toContain("Git Tracking Details");
    expect(panel.webview.html).not.toContain(".git/info/exclude");
  });

  it("does not render git-tracking details in track mode", async () => {
    const panel = {
      webview: {
        html: ""
      }
    } as any;

    vi.spyOn(vscode.window, "createWebviewPanel").mockReturnValue(panel);

    const opened = await openPostInstallGuidancePage({
      targetRootPath: "/workspace/project",
      selectedProfile: "dotnet-csharp-web-api-simple",
      logFilePath: "/tmp/storage/operation-logs/install-log.jsonl",
      managedStatePath: "/workspace/project/.codex-onboarding/.managed/state.json",
      gitMode: "track",
      gitTrackingStrategy: "git_info_exclude",
      gitTrackingUpdated: false,
      appliedCount: 1,
      skippedCount: 0,
      removedStaleCount: 0,
      extensionVersion: "1.2.3",
      bundleId: "dotnet-csharp-web-api-simple",
      bundleVersion: "7",
      capabilityTags: [],
      operationId: "install-123"
    });

    expect(opened).toBe(true);
    expect(panel.webview.html).not.toContain("Git Tracking Details");
    expect(panel.webview.html).not.toContain("To exit ignore mode");
  });
});
