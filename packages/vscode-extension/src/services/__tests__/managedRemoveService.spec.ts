import * as fs from "node:fs/promises";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { SelectedTopic } from "../../contracts/selection";
import { applyManagedInstall } from "../managedInstallService";
import { removeManagedOnboarding } from "../managedRemoveService";
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

describe("removeManagedOnboarding", () => {
  it("removes only unchanged managed files and preserves modified ones", async () => {
    const fixture = await createFixturePaths("managed-remove");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    await writeTopic(fixture.assetRoot, topicRepo.path, topicRepo.file_id);
    await writeTopic(fixture.assetRoot, topicAuth.path, topicAuth.file_id);

    const logger = { log: vi.fn() };

    const installed = await applyManagedInstall(
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
      "codex-onboarding/core/topics/dotnet/csharp/security/auth-guidance.md"
    );

    await fs.appendFile(modifiedPath, "\n# changed by consumer\n", "utf8");

    const removed = await removeManagedOnboarding(fixture.targetRoot, logger);

    expect(removed.stateCleared).toBe(true);
    expect(removed.removedFiles).toContain("codex-onboarding/core/AGENT-ONBOARDING.md");
    expect(removed.preservedModifiedFiles).toContain(
      "codex-onboarding/core/topics/dotnet/csharp/security/auth-guidance.md"
    );

    await expect(fs.readFile(installed.statePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.readFile(modifiedPath, "utf8")).resolves.toContain("changed by consumer");
  });

  it("tracks managed files that are already missing during remove", async () => {
    const fixture = await createFixturePaths("managed-remove-missing-file");
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

    const topicPath = path.join(
      fixture.targetRoot,
      "codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );
    await fs.unlink(topicPath);

    const removed = await removeManagedOnboarding(fixture.targetRoot, logger);

    expect(removed.missingManagedFiles).toContain("codex-onboarding/core/topics/cross-cutting/repo-guidance.md");
  });

  it("treats invalid managed state shape as corrupt", async () => {
    const fixture = await createFixturePaths("managed-remove-invalid-shape");
    cleanups.push(fixture.tempRoot);

    const managedRoot = path.join(fixture.targetRoot, "codex-onboarding", ".managed");
    await fs.mkdir(managedRoot, { recursive: true });

    const statePath = path.join(managedRoot, "state.json");
    await fs.writeFile(statePath, JSON.stringify({ managed_files: "invalid" }), "utf8");

    const logger = { log: vi.fn() };
    const result = await removeManagedOnboarding(fixture.targetRoot, logger);

    expect(result.hadState).toBe(true);
    expect(result.stateCorrupt).toBe(true);
    expect(result.stateCleared).toBe(true);
    expect(result.removedFiles).toHaveLength(0);
  });

  it("clears corrupt state file without deleting managed files blindly", async () => {
    const fixture = await createFixturePaths("managed-remove-corrupt-state");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);

    const managedRoot = path.join(fixture.targetRoot, "codex-onboarding", ".managed");
    await fs.mkdir(managedRoot, { recursive: true });

    const statePath = path.join(managedRoot, "state.json");
    await fs.writeFile(statePath, "{ this is invalid json", "utf8");

    const logger = { log: vi.fn() };
    const result = await removeManagedOnboarding(fixture.targetRoot, logger);

    expect(result.stateCorrupt).toBe(true);
    expect(result.stateCleared).toBe(true);
    expect(result.removedFiles).toHaveLength(0);

    await expect(fs.readFile(statePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("is safe when no state file exists", async () => {
    const fixture = await createFixturePaths("managed-remove-no-state");
    cleanups.push(fixture.tempRoot);

    const logger = { log: vi.fn() };
    const result = await removeManagedOnboarding(fixture.targetRoot, logger);

    expect(result.hadState).toBe(false);
    expect(result.stateCleared).toBe(true);
    expect(result.removedFiles).toHaveLength(0);
  });
});
