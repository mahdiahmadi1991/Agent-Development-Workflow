import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanupFixture, createFixturePaths } from "../../test-utils/fixtureFactory";
import { requireUpdateConsentIfNeeded } from "../updateConsentService";

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const root = cleanups.pop();
    if (root) {
      await cleanupFixture(root);
    }
  }
});

describe("requireUpdateConsentIfNeeded", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);
    vi.spyOn(vscode.env, "openExternal").mockResolvedValue(true);
  });

  it("returns no_managed_state when no state file exists", async () => {
    const fixture = await createFixturePaths("update-consent-no-state");
    cleanups.push(fixture.tempRoot);

    const result = await requireUpdateConsentIfNeeded(
      {
        command: "install",
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        repositoryUrl: "https://github.com/example/repo.git"
      },
      { log: vi.fn() }
    );

    expect(result).toEqual(
      expect.objectContaining({
        updateAvailable: false,
        blocked: false,
        reason: "no_managed_state"
      })
    );
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it("returns already_synchronized when bundle and extension versions match state", async () => {
    const fixture = await createFixturePaths("update-consent-no-update");
    cleanups.push(fixture.tempRoot);

    const statePath = path.join(fixture.targetRoot, ".codex-onboarding", ".managed", "state.json");
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(
      statePath,
      JSON.stringify(
        {
          bundle_id: "dotnet-csharp-web-api-simple",
          bundle_version: "1",
          extension_version: "0.0.1",
          applied_at_utc: new Date().toISOString(),
          managed_files: []
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await requireUpdateConsentIfNeeded(
      {
        command: "install",
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        repositoryUrl: "https://github.com/example/repo.git"
      },
      { log: vi.fn() }
    );

    expect(result).toEqual(
      expect.objectContaining({
        updateAvailable: false,
        blocked: false,
        reason: "already_synchronized"
      })
    );
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it("requires release notes and changelog review before allowing update", async () => {
    const fixture = await createFixturePaths("update-consent-approved");
    cleanups.push(fixture.tempRoot);

    const statePath = path.join(fixture.targetRoot, ".codex-onboarding", ".managed", "state.json");
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(
      statePath,
      JSON.stringify(
        {
          bundle_id: "dotnet-csharp-web-api-simple",
          bundle_version: "1",
          extension_version: "0.0.1",
          applied_at_utc: new Date().toISOString(),
          managed_files: []
        },
        null,
        2
      ),
      "utf8"
    );

    vi.spyOn(vscode.window, "showInformationMessage")
      .mockResolvedValueOnce("Open Release Notes" as any)
      .mockResolvedValueOnce("Open Changelog" as any)
      .mockResolvedValueOnce("Continue Update" as any);

    const result = await requireUpdateConsentIfNeeded(
      {
        command: "install",
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "2",
        extensionVersion: "0.0.2",
        repositoryUrl: "https://github.com/example/repo.git"
      },
      { log: vi.fn() }
    );

    expect(result).toEqual(
      expect.objectContaining({
        updateAvailable: true,
        blocked: false,
        reason: "update_consent_granted"
      })
    );
    expect(vscode.env.openExternal).toHaveBeenCalledTimes(2);
  });

  it("blocks update when user declines update review", async () => {
    const fixture = await createFixturePaths("update-consent-declined");
    cleanups.push(fixture.tempRoot);

    const statePath = path.join(fixture.targetRoot, ".codex-onboarding", ".managed", "state.json");
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(
      statePath,
      JSON.stringify(
        {
          bundle_id: "dotnet-csharp-web-api-simple",
          bundle_version: "1",
          extension_version: "0.0.1",
          applied_at_utc: new Date().toISOString(),
          managed_files: []
        },
        null,
        2
      ),
      "utf8"
    );

    vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValueOnce("Cancel Update" as any);

    const result = await requireUpdateConsentIfNeeded(
      {
        command: "repair",
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "2",
        extensionVersion: "0.0.2",
        repositoryUrl: "https://github.com/example/repo.git"
      },
      { log: vi.fn() }
    );

    expect(result).toEqual(
      expect.objectContaining({
        updateAvailable: true,
        blocked: true,
        reason: "update_consent_declined"
      })
    );
    expect(vscode.env.openExternal).not.toHaveBeenCalled();
  });
});
