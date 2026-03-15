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

  it("detects missing tracked managed files during impact scan", async () => {
    const fixture = await createFixturePaths("managed-remove-impact-missing");
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

    const missingPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );
    await fs.rm(missingPath, { force: true });

    const impact = await analyzeManagedRemoveImpact(fixture.targetRoot, logger);
    expect(impact.missingManagedFiles).toContain(
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );
    expect(impact.requiresConfirmation).toBe(true);
  });

  it("propagates non-ENOENT managed file read errors during impact scan", async () => {
    const fixture = await createFixturePaths("managed-remove-impact-read-error");
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

    const brokenPath = path.join(fixture.targetRoot, ".codex-onboarding", "AGENTS.md");
    await fs.chmod(brokenPath, 0o000);

    await expect(analyzeManagedRemoveImpact(fixture.targetRoot, logger)).rejects.toMatchObject({
      code: expect.stringMatching(/EACCES|EPERM/)
    });

    await fs.chmod(brokenPath, 0o644);
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

  it("safe remove preserves consumer-modified managed files and reports missing managed files", async () => {
    const fixture = await createFixturePaths("managed-remove-safe-modified-missing");
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
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );
    const missingPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/dotnet/csharp/security/auth-guidance.md"
    );
    await fs.appendFile(modifiedPath, "\n# local change\n", "utf8");
    await fs.rm(missingPath, { force: true });

    const removed = await removeManagedOnboarding(fixture.targetRoot, logger, {
      removeWholeManagedRoot: false
    });

    expect(removed.skippedChangedManagedFiles).toContain(
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );
    expect(removed.missingManagedFiles).toContain(
      ".codex-onboarding/core/topics/dotnet/csharp/security/auth-guidance.md"
    );
    await expect(fs.readFile(modifiedPath, "utf8")).resolves.toContain("# local change");
  });

  it("handles corrupt state in safe remove mode without deleting unknown managed files", async () => {
    const fixture = await createFixturePaths("managed-remove-safe-corrupt");
    cleanups.push(fixture.tempRoot);

    const managedRoot = path.join(fixture.targetRoot, ".codex-onboarding", ".managed");
    await fs.mkdir(managedRoot, { recursive: true });
    await fs.writeFile(path.join(managedRoot, "state.json"), "{ invalid", "utf8");

    const logger = { log: vi.fn() };
    const result = await removeManagedOnboarding(fixture.targetRoot, logger, {
      removeWholeManagedRoot: false
    });

    expect(result.stateCorrupt).toBe(true);
    expect(result.stateCleared).toBe(true);
    expect(result.removeMode).toBe("safe_state_cleanup");
  });

  it("propagates non-ENOENT managed file read errors during safe remove", async () => {
    const fixture = await createFixturePaths("managed-remove-safe-read-error");
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

    const managedPath = path.join(fixture.targetRoot, ".codex-onboarding", "AGENTS.md");
    await fs.chmod(managedPath, 0o000);

    await expect(
      removeManagedOnboarding(fixture.targetRoot, logger, {
        removeWholeManagedRoot: false
      })
    ).rejects.toMatchObject({ code: expect.stringMatching(/EACCES|EPERM/) });

    await fs.chmod(managedPath, 0o644);
  });

  it("propagates non-ENOENT state unlink errors during safe remove", async () => {
    const fixture = await createFixturePaths("managed-remove-state-unlink-error");
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

    await fs.chmod(path.dirname(installed.statePath), 0o500);

    await expect(
      removeManagedOnboarding(fixture.targetRoot, logger, {
        removeWholeManagedRoot: false
      })
    ).rejects.toMatchObject({ code: expect.stringMatching(/EACCES|EPERM/) });

    await fs.chmod(path.dirname(installed.statePath), 0o700);
  });

  it("propagates non-ENOENT report cleanup errors in safe remove", async () => {
    const fixture = await createFixturePaths("managed-remove-report-cleanup-error");
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

    const reportPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/.managed/applied-artifacts.md"
    );
    await fs.rm(reportPath, { force: true });
    await fs.mkdir(reportPath, { recursive: true });

    await expect(
      removeManagedOnboarding(fixture.targetRoot, logger, {
        removeWholeManagedRoot: false
      })
    ).rejects.toMatchObject({ code: expect.stringMatching(/EISDIR|EPERM|EACCES/) });
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

  it("marks invalid managed_files state shape as corrupt in impact scan", async () => {
    const fixture = await createFixturePaths("managed-remove-impact-invalid-shape");
    cleanups.push(fixture.tempRoot);

    const managedRoot = path.join(fixture.targetRoot, ".codex-onboarding", ".managed");
    await fs.mkdir(managedRoot, { recursive: true });
    await fs.writeFile(
      path.join(managedRoot, "state.json"),
      JSON.stringify({ managed_files: "invalid" }),
      "utf8"
    );

    const logger = { log: vi.fn() };
    const impact = await analyzeManagedRemoveImpact(fixture.targetRoot, logger);
    expect(impact.stateCorrupt).toBe(true);
    expect(impact.requiresConfirmation).toBe(true);
  });

  it("ignores non-file entries under managed root during impact scan", async () => {
    const fixture = await createFixturePaths("managed-remove-impact-non-file-entry");
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

    const symlinkPath = path.join(fixture.targetRoot, ".codex-onboarding", "symlink-entry");
    const targetPath = path.join(fixture.targetRoot, ".codex-onboarding", "AGENTS.md");
    await fs.symlink(targetPath, symlinkPath);

    const impact = await analyzeManagedRemoveImpact(fixture.targetRoot, logger);
    expect(impact.untrackedFiles).not.toContain(".codex-onboarding/symlink-entry");
  });

  it("propagates non-ENOENT scan errors while walking managed root", async () => {
    const fixture = await createFixturePaths("managed-remove-impact-scan-error");
    cleanups.push(fixture.tempRoot);

    const managedRoot = path.join(fixture.targetRoot, ".codex-onboarding");
    await fs.mkdir(managedRoot, { recursive: true });
    await fs.chmod(managedRoot, 0o000);

    const logger = { log: vi.fn() };
    await expect(analyzeManagedRemoveImpact(fixture.targetRoot, logger)).rejects.toMatchObject({
      code: expect.stringMatching(/EACCES|EPERM/)
    });

    await fs.chmod(managedRoot, 0o755);
  });

  it("handles removeEmptyParentDirs ENOTEMPTY branch when sibling files still exist", async () => {
    const fixture = await createFixturePaths("managed-remove-parent-enotempty");
    cleanups.push(fixture.tempRoot);

    const secondCrossCuttingTopic: SelectedTopic = {
      file_id: "repo-guidance-2",
      path: "topics/cross-cutting/repo-guidance-2.md",
      category: "cross-cutting",
      required: false,
      reasons: ["selected_by_capability"]
    };

    await writeBootstrap(fixture.assetRoot);
    await writeTopic(fixture.assetRoot, topicRepo.path, topicRepo.file_id);
    await writeTopic(fixture.assetRoot, secondCrossCuttingTopic.path, secondCrossCuttingTopic.file_id);

    const logger = { log: vi.fn() };
    const installed = await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        selectedTopics: [topicRepo, secondCrossCuttingTopic]
      },
      logger
    );

    const removed = await removeManagedOnboarding(fixture.targetRoot, logger, {
      removeWholeManagedRoot: false
    });

    expect(removed.stateCleared).toBe(true);
    await expect(fs.readFile(installed.statePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
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

  it("uses default remove options when options argument is omitted", async () => {
    const fixture = await createFixturePaths("managed-remove-default-options");
    cleanups.push(fixture.tempRoot);

    const logger = { log: vi.fn() };
    const result = await removeManagedOnboarding(fixture.targetRoot, logger);

    expect(result.removeMode).toBe("safe_state_cleanup");
    expect(result.removedManagedRoot).toBe(false);
  });
});
