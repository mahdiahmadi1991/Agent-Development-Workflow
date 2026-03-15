import * as vscode from "vscode";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { requirePreInstallTransparencyAcknowledgement } from "../preInstallTransparencyService";

describe("requirePreInstallTransparencyAcknowledgement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showTextDocument").mockResolvedValue(undefined as never);
    vi.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue({} as vscode.TextDocument);
    vi.spyOn(vscode.env, "openExternal").mockResolvedValue(true);
  });

  it("acknowledges when user selects continue", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValueOnce({
      value: "continue"
    } as never);

    const result = await requirePreInstallTransparencyAcknowledgement(
      {
        command: "install",
        targetRootPath: "/workspace/sample",
        repositoryUrl: "https://github.com/example/repo.git",
        selectedTopics: [
          {
            fileId: "base-topic",
            category: "00-core",
            reasons: ["selected_by_profile_baseline"]
          }
        ]
      },
      { log: vi.fn() }
    );

    expect(result).toEqual({
      acknowledged: true,
      openedSummary: false
    });
  });

  it("opens consumer summary and blocks install", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValueOnce({
      value: "open_summary"
    } as never);

    const result = await requirePreInstallTransparencyAcknowledgement(
      {
        command: "install",
        targetRootPath: "/workspace/sample",
        repositoryUrl: "https://github.com/example/repo.git",
        selectedTopics: []
      },
      { log: vi.fn() }
    );

    expect(vscode.env.openExternal).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      acknowledged: false,
      openedSummary: true
    });
  });

  it("opens explainability document and blocks install", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValueOnce({
      value: "open_explainability"
    } as never);

    const result = await requirePreInstallTransparencyAcknowledgement(
      {
        command: "install",
        targetRootPath: "/workspace/sample",
        selectedTopics: [
          {
            fileId: "topic-a",
            category: "cross-cutting",
            reasons: ["selected_by_capability"]
          },
          {
            fileId: "topic-b",
            category: "dotnet/csharp",
            reasons: ["selected_as_dependency"]
          }
        ]
      },
      { log: vi.fn() }
    );

    expect(vscode.workspace.openTextDocument).toHaveBeenCalledTimes(1);
    expect(vscode.window.showTextDocument).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      acknowledged: false,
      openedSummary: false
    });
  });

  it("blocks when user cancels transparency check", async () => {
    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValueOnce(undefined);

    const result = await requirePreInstallTransparencyAcknowledgement(
      {
        command: "install",
        targetRootPath: "/workspace/sample",
        selectedTopics: []
      },
      { log: vi.fn() }
    );

    expect(result).toEqual({
      acknowledged: false,
      openedSummary: false
    });
  });
});
