import * as vscode from "vscode";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  COPY_STARTER_PROMPT_COMMAND,
  POST_INSTALL_PANEL_TITLE,
  POST_INSTALL_PANEL_VIEW_TYPE,
  REPORT_ISSUE_COMMAND,
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
      appliedCount: 3,
      skippedCount: 1,
      removedStaleCount: 2
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
    expect(panel.webview.html).toContain("First 3 Steps");
    expect(panel.webview.html).toContain("Prompt Packs");
    expect(panel.webview.html).toContain("Safe Boundaries");
    expect(panel.webview.html).toContain("Lifecycle Playbook");
    expect(panel.webview.html).toContain("Change Report");

    expect(panel.webview.html).toContain("Open Managed Root");
    expect(panel.webview.html).toContain("Open Operation Log");
    expect(panel.webview.html).toContain("Run Repair");
    expect(panel.webview.html).toContain("Run Remove");
    expect(panel.webview.html).toContain("command:codexOnboarding.repair");
    expect(panel.webview.html).toContain("command:codexOnboarding.remove");

    expect(panel.webview.html).toContain("command:" + COPY_STARTER_PROMPT_COMMAND);
    expect(panel.webview.html).toContain("command:" + REPORT_ISSUE_COMMAND);

    expect(panel.webview.html).toContain("Discover");
    expect(panel.webview.html).toContain("Implement");
    expect(panel.webview.html).toContain("Validate");

    expect(panel.webview.html).toContain("/workspace/project/.codex-onboarding/.managed/state.json");
    expect(panel.webview.html).toContain("/tmp/storage/operation-logs/install-log.jsonl");

    const html = panel.webview.html;
    const actionBarIndex = html.indexOf("action-bar");
    const outcomeIndex = html.indexOf("Outcome Snapshot");
    const beforeAfterIndex = html.indexOf("Before/After Map");
    const firstStepsIndex = html.indexOf("First 3 Steps");
    const promptPacksIndex = html.indexOf("Prompt Packs");
    const safeBoundariesIndex = html.indexOf("Safe Boundaries");
    const lifecycleIndex = html.indexOf("Lifecycle Playbook");
    const changeReportIndex = html.indexOf("Change Report");

    expect(actionBarIndex).toBeGreaterThanOrEqual(0);
    expect(actionBarIndex).toBeLessThan(outcomeIndex);
    expect(outcomeIndex).toBeLessThan(beforeAfterIndex);
    expect(beforeAfterIndex).toBeLessThan(firstStepsIndex);
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
      appliedCount: 3,
      skippedCount: 1,
      removedStaleCount: 2
    });

    expect(opened).toBe(false);
    expect(warningSpy).toHaveBeenCalledWith(
      "Install completed, but the post-install guidance panel could not be opened."
    );
  });
});
