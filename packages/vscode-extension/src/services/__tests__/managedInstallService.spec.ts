import * as fs from "node:fs/promises";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { SelectedTopic } from "../../contracts/selection";
import { applyManagedInstall } from "../managedInstallService";
import {
  cleanupFixture,
  createFixturePaths,
  writeBootstrap,
  writeTopic,
  writeAssetFile
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

describe("applyManagedInstall", () => {
  it("installs bootstrap and selected topics and writes managed state", async () => {
    const fixture = await createFixturePaths("managed-install");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    await writeTopic(fixture.assetRoot, topicRepo.path, topicRepo.file_id);

    const logger = { log: vi.fn() };

    const result = await applyManagedInstall(
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

    expect(result.appliedFiles).toHaveLength(5);
    expect(result.skippedFiles).toHaveLength(0);
    expect(result.removedStaleFiles).toHaveLength(0);

    const bootstrapPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/AGENTS.md"
    );
    const topicPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );

    await expect(fs.readFile(bootstrapPath, "utf8")).resolves.toContain("bundle_id: dotnet-csharp-web-api-simple");
    await expect(fs.readFile(topicPath, "utf8")).resolves.toContain("extension_version: 0.0.1");

    const stateRaw = await fs.readFile(result.statePath, "utf8");
    const state = JSON.parse(stateRaw) as {
      managed_files: Array<{ relative_path: string }>;
    };

    expect(state.managed_files.map((item) => item.relative_path).sort()).toEqual([
      ".codex-onboarding/.gitignore",
      ".codex-onboarding/AGENTS.md",
      ".codex-onboarding/INDEX.md",
      ".codex-onboarding/ISSUE-REPORTING.md",
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    ]);
  });

  it("keeps existing non-managed files untouched and skips them", async () => {
    const fixture = await createFixturePaths("managed-install-non-destructive");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    await writeTopic(fixture.assetRoot, topicRepo.path, topicRepo.file_id);

    const destinationPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.writeFile(destinationPath, "# consumer owned file\n", "utf8");

    const logger = { log: vi.fn() };

    const result = await applyManagedInstall(
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

    expect(result.skippedFiles).toContain(".codex-onboarding/core/topics/cross-cutting/repo-guidance.md");
    expect(result.appliedFiles).toContain(".codex-onboarding/AGENTS.md");
    await expect(fs.readFile(destinationPath, "utf8")).resolves.toContain("consumer owned file");
  });

  it("removes stale managed files when profile/topic selection shrinks", async () => {
    const fixture = await createFixturePaths("managed-install-stale");
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

    const second = await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "2",
        extensionVersion: "0.0.2",
        selectedTopics: [topicRepo]
      },
      logger
    );

    expect(second.removedStaleFiles).toContain(
      ".codex-onboarding/core/topics/dotnet/csharp/security/auth-guidance.md"
    );

    const stalePath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/dotnet/csharp/security/auth-guidance.md"
    );

    await expect(fs.readFile(stalePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails fast when stale managed file is missing", async () => {
    const fixture = await createFixturePaths("managed-install-stale-missing");
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

    const stalePath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/dotnet/csharp/security/auth-guidance.md"
    );
    await fs.unlink(stalePath);

    await expect(
      applyManagedInstall(
        {
          extensionPath: fixture.extensionPath,
          targetRootPath: fixture.targetRoot,
          bundleId: "dotnet-csharp-web-api-simple",
          bundleVersion: "2",
          extensionVersion: "0.0.2",
          selectedTopics: [topicRepo]
        },
        logger
      )
    ).rejects.toThrow(/stale managed file.*missing/i);
  });

  it("fails fast when stale managed file was modified", async () => {
    const fixture = await createFixturePaths("managed-install-stale-drift");
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

    const stalePath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/dotnet/csharp/security/auth-guidance.md"
    );

    await fs.appendFile(stalePath, "\n# user change\n", "utf8");

    await expect(
      applyManagedInstall(
        {
          extensionPath: fixture.extensionPath,
          targetRootPath: fixture.targetRoot,
          bundleId: "dotnet-csharp-web-api-simple",
          bundleVersion: "2",
          extensionVersion: "0.0.2",
          selectedTopics: [topicRepo]
        },
        logger
      )
    ).rejects.toThrow(/stale managed file/i);
  });

  it("repair mode recovers untracked managed files when content matches desired", async () => {
    const fixture = await createFixturePaths("managed-repair-recover");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    await writeTopic(fixture.assetRoot, topicRepo.path, topicRepo.file_id);

    const logger = { log: vi.fn() };

    const first = await applyManagedInstall(
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

    await fs.unlink(first.statePath);

    const repaired = await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        selectedTopics: [topicRepo],
        mode: "repair"
      },
      logger
    );

    expect(repaired.recoveredTrackedFiles).toEqual(
      expect.arrayContaining([
        ".codex-onboarding/AGENTS.md",
        ".codex-onboarding/INDEX.md",
        ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
      ])
    );
  });

  it("repair mode blocks untracked managed files when content does not match desired", async () => {
    const fixture = await createFixturePaths("managed-repair-block");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    await writeTopic(fixture.assetRoot, topicRepo.path, topicRepo.file_id);

    const logger = { log: vi.fn() };

    const first = await applyManagedInstall(
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

    await fs.unlink(first.statePath);

    const managedTopicPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );

    await fs.appendFile(managedTopicPath, "\n# edited\n", "utf8");

    await expect(
      applyManagedInstall(
        {
          extensionPath: fixture.extensionPath,
          targetRootPath: fixture.targetRoot,
          bundleId: "dotnet-csharp-web-api-simple",
          bundleVersion: "1",
          extensionVersion: "0.0.1",
          selectedTopics: [topicRepo],
          mode: "repair"
        },
        logger
      )
    ).rejects.toThrow("not tracked in state");
  });

  it("fails fast when tracked managed file is modified", async () => {
    const fixture = await createFixturePaths("managed-install-tracked-drift");
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

    const managedPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );

    await fs.appendFile(managedPath, "\n# local drift\n", "utf8");

    await expect(
      applyManagedInstall(
        {
          extensionPath: fixture.extensionPath,
          targetRootPath: fixture.targetRoot,
          bundleId: "dotnet-csharp-web-api-simple",
          bundleVersion: "2",
          extensionVersion: "0.0.2",
          selectedTopics: [topicRepo]
        },
        logger
      )
    ).rejects.toThrow("Managed drift detected");
  });

  it("fails fast when tracked managed file is missing during update and performs no partial writes", async () => {
    const fixture = await createFixturePaths("managed-install-tracked-missing");
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

    const managedTopicPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );
    await fs.unlink(managedTopicPath);

    await expect(
      applyManagedInstall(
        {
          extensionPath: fixture.extensionPath,
          targetRootPath: fixture.targetRoot,
          bundleId: "dotnet-csharp-web-api-simple",
          bundleVersion: "2",
          extensionVersion: "0.0.2",
          selectedTopics: [topicRepo]
        },
        logger
      )
    ).rejects.toThrow("Managed missing file detected");

    await expect(
      fs.readFile(path.join(fixture.targetRoot, ".codex-onboarding/AGENTS.md"), "utf8")
    ).resolves.toContain("extension_version: 0.0.1");
  });

  it("repair mode can reset tracked managed drift when forced by explicit confirmation", async () => {
    const fixture = await createFixturePaths("managed-repair-force-reset");
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

    const managedPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );
    await fs.appendFile(managedPath, "\n# local drift\n", "utf8");

    const repaired = await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        selectedTopics: [topicRepo],
        mode: "repair",
        forceResetModifiedManagedFiles: true
      },
      logger
    );

    expect(repaired.appliedFiles).toContain(
      ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
    );
    await expect(fs.readFile(managedPath, "utf8")).resolves.not.toContain("# local drift");
  });

  it("keeps tracked files up to date without rewriting unchanged content", async () => {
    const fixture = await createFixturePaths("managed-install-up-to-date");
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

    const second = await applyManagedInstall(
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

    expect(second.appliedFiles).toHaveLength(0);
    expect(second.skippedFiles).toHaveLength(0);
    expect(second.removedStaleFiles).toHaveLength(0);
  });

  it("fails when existing managed state shape is invalid", async () => {
    const fixture = await createFixturePaths("managed-install-invalid-state");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    await writeTopic(fixture.assetRoot, topicRepo.path, topicRepo.file_id);

    const managedRoot = path.join(fixture.targetRoot, ".codex-onboarding", ".managed");
    await fs.mkdir(managedRoot, { recursive: true });
    await fs.writeFile(
      path.join(managedRoot, "state.json"),
      JSON.stringify({ managed_files: "invalid" }),
      "utf8"
    );

    const logger = { log: vi.fn() };

    await expect(
      applyManagedInstall(
        {
          extensionPath: fixture.extensionPath,
          targetRootPath: fixture.targetRoot,
          bundleId: "dotnet-csharp-web-api-simple",
          bundleVersion: "1",
          extensionVersion: "0.0.1",
          selectedTopics: [topicRepo]
        },
        logger
      )
    ).rejects.toThrow("managed_files must be an array");
  });

  it("accepts topic path aliases and normalizes destination under managed core", async () => {
    const fixture = await createFixturePaths("managed-install-topic-alias");
    cleanups.push(fixture.tempRoot);

    await writeBootstrap(fixture.assetRoot);
    await writeAssetFile(
      fixture.assetRoot,
      "library/topics/cross-cutting/repo-guidance.md",
      [
        "<!--",
        "artifact_id: repo-guidance",
        "managed: true",
        "schema_version: 1",
        "bundle_id: TBD",
        "bundle_version: TBD",
        "extension_version: TBD",
        "-->",
        "",
        "# repo-guidance"
      ].join("\n")
    );

    const aliasedTopic: SelectedTopic = {
      ...topicRepo,
      path: "library/topics/cross-cutting/repo-guidance.md"
    };

    const logger = { log: vi.fn() };

    const result = await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: "dotnet-csharp-web-api-simple",
        bundleVersion: "1",
        extensionVersion: "0.0.1",
        selectedTopics: [aliasedTopic]
      },
      logger
    );

    expect(result.appliedFiles).toContain(".codex-onboarding/core/topics/cross-cutting/repo-guidance.md");

    await expect(
      fs.readFile(
        path.join(
          fixture.targetRoot,
          ".codex-onboarding/core/topics/cross-cutting/repo-guidance.md"
        ),
        "utf8"
      )
    ).resolves.toContain("bundle_id: dotnet-csharp-web-api-simple");
  });
});
