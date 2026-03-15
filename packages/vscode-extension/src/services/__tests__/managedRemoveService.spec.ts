import * as fs from "node:fs/promises";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { SelectedTopic } from "../../contracts/selection";
import { applyManagedInstall } from "../managedInstallService";
import {
  analyzeManagedRemoveImpact,
  removeManagedOnboarding
} from "../managedRemoveService";
import {
  cleanupFixture,
  createFixturePaths,
  writeBootstrap,
  writeTopic
} from "../../test-utils/fixtureFactory";

const topicRepo: SelectedTopic = {
  file_id: "repo-guidance",
  path: "topics/cross-cutting/repo-guidance.md",
  category: "cross-cutting",
  required: false,
  reasons: ["selected_by_capability"]
};

const topicAuth: SelectedTopic = {
  file_id: "auth-guidance",
  path: "topics/dotnet/csharp/security/auth-guidance.md",
  category: "security",
  required: false,
  reasons: ["selected_by_capability"]
};

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const root = cleanups.pop();
    if (root) {
      await cleanupFixture(root);
    }
  }
});

describe("managedRemoveService", () => {
  it("analyzes clean managed root as removable without confirmation", async () => {
    const fixture = await createFixturePaths("managed-remove-analyze-clean");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    await writeTopic(fixture.assetRoot, topicRepo.path, topicRepo.file_id);

    const logger = { log: vi.fn() };
    await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        selectedTopics: [topicRepo]
      },
      logger
    );

    const impact = await analyzeManagedRemoveImpact(fixture.targetRoot, logger);

    expect(impact.stateCorrupt).toBe(false);
    expect(impact.modifiedManagedFiles).toHaveLength(0);
    expect(impact.missingManagedFiles).toHaveLength(0);
    expect(impact.untrackedFiles).toHaveLength(0);
    expect(impact.requiresConfirmation).toBe(false);
  });

  it("detects modified managed files and user-added files for destructive remove confirmation", async () => {
    const fixture = await createFixturePaths("managed-remove-analyze-drift");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    await writeTopic(fixture.assetRoot, topicRepo.path, topicRepo.file_id);

    const logger = { log: vi.fn() };
    await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        selectedTopics: [topicRepo]
      },
      logger
    );

    const modifiedPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );
    await fs.appendFile(modifiedPath, "\n# changed by consumer\n", "utf8");

    const userAddedPath = path.join(fixture.targetRoot, ".codex-onboarding/custom/user-note.md");
    await fs.mkdir(path.dirname(userAddedPath), { recursive: true });
    await fs.writeFile(userAddedPath, "user note", "utf8");

    const impact = await analyzeManagedRemoveImpact(fixture.targetRoot, logger);

    expect(impact.modifiedManagedFiles).toContain(
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );
    expect(impact.untrackedFiles).toContain(".codex-onboarding/custom/user-note.md");
    expect(impact.requiresConfirmation).toBe(true);
  });

  it("safe remove mode removes managed files without prompt when no changes exist", async () => {
    const fixture = await createFixturePaths("managed-remove-safe");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    await writeTopic(fixture.assetRoot, topicRepo.path, topicRepo.file_id);

    const logger = { log: vi.fn() };
    const installed = await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        selectedTopics: [topicRepo]
      },
      logger
    );

    const logFilePath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/.managed/logs/install-2026-03-15-remove-test.jsonl"
    );
    await fs.mkdir(path.dirname(logFilePath), { recursive: true });
    await fs.writeFile(logFilePath, "{\"event\":\"sample\"}\n", "utf8");

    const removed = await removeManagedOnboarding(fixture.targetRoot, logger, {
      removeWholeManagedRoot: false
    });

    expect(removed.removeMode).toBe("safe_state_cleanup");
    expect(removed.removedManagedRoot).toBe(false);
    expect(removed.removedFiles).toEqual(
      expect.arrayContaining([
        ".codex-onboarding/AGENTS.md",
        ".codex-onboarding/.gitignore",
        ".codex-onboarding/.managed/applied-artifacts.md",
        ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md",
        ".codex-onboarding/.managed/logs/install-2026-03-15-remove-test.jsonl"
      ])
    );
    await expect(fs.readFile(installed.statePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.access(path.join(fixture.targetRoot, ".codex-onboarding"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("full-root remove mode deletes modified and user-added files together", async () => {
    const fixture = await createFixturePaths("managed-remove-full-root");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    await writeTopic(fixture.assetRoot, topicRepo.path, topicRepo.file_id);
    await writeTopic(fixture.assetRoot, topicAuth.path, topicAuth.file_id);

    const logger = { log: vi.fn() };
    await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        selectedTopics: [topicRepo, topicAuth]
      },
      logger
    );

    const modifiedPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/dotnet/csharp/security/auth-guidance.md"
    );
    await fs.appendFile(modifiedPath, "\n# changed by consumer\n", "utf8");

    const userAddedPath = path.join(fixture.targetRoot, ".codex-onboarding/custom/user-note.md");
    await fs.mkdir(path.dirname(userAddedPath), { recursive: true });
    await fs.writeFile(userAddedPath, "note", "utf8");

    const removed = await removeManagedOnboarding(fixture.targetRoot, logger, {
      removeWholeManagedRoot: true
    });

    expect(removed.removeMode).toBe("full_root_reset");
    expect(removed.removedManagedRoot).toBe(true);
    expect(removed.removedFiles).toContain(".codex-onboarding/custom/user-note.md");
    await expect(fs.access(path.join(fixture.targetRoot, ".codex-onboarding"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("marks corrupt state as confirmation-required in impact scan", async () => {
    const fixture = await createFixturePaths("managed-remove-impact-corrupt-state");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    const managedRoot = path.join(fixture.targetRoot, ".codex-onboarding", ".managed");
    await fs.mkdir(managedRoot, { recursive: true });
    await fs.writeFile(path.join(managedRoot, "state.json"), "{ invalid", "utf8");

    const logger = { log: vi.fn() };
    const impact = await analyzeManagedRemoveImpact(fixture.targetRoot, logger);

    expect(impact.stateCorrupt).toBe(true);
    expect(impact.requiresConfirmation).toBe(true);
  });

  it("is safe no-op when managed root does not exist", async () => {
    const fixture = await createFixturePaths("managed-remove-no-managed-root");
    cleanups.push(fixture.tempRoot);

    const logger = { log: vi.fn() };
    const impact = await analyzeManagedRemoveImpact(fixture.targetRoot, logger);
    const result = await removeManagedOnboarding(fixture.targetRoot, logger, {
      removeWholeManagedRoot: false
    });

    expect(impact.requiresConfirmation).toBe(false);
    expect(result.removedFiles).toHaveLength(0);
    expect(result.stateCleared).toBe(true);
  });
});
