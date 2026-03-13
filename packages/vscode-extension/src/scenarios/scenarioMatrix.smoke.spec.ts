import * as fs from "node:fs/promises";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { applyManagedInstall } from "../services/managedInstallService";
import { removeManagedOnboarding } from "../services/managedRemoveService";
import { loadResolvedProfile } from "../services/profileAssetService";
import { loadQuestionnaireAssets } from "../services/questionnaireAssetService";
import { resolveSelectionPlan } from "../services/selectionResolver";
import {
  cleanupFixture,
  createFixturePaths,
  writeAssetFile
} from "../test-utils/fixtureFactory";

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const root = cleanups.pop();
    if (root) {
      await cleanupFixture(root);
    }
  }
});

async function seedSmokeAssets(assetRoot: string): Promise<void> {
  await writeAssetFile(
    assetRoot,
    "core/AGENT-ONBOARDING.md",
    [
      "<!--",
      "artifact_id: core-agent-onboarding",
      "managed: true",
      "schema_version: 1",
      "bundle_id: TBD",
      "bundle_version: TBD",
      "extension_version: TBD",
      "-->",
      "",
      "# AGENT-ONBOARDING"
    ].join("\n")
  );

  await writeAssetFile(
    assetRoot,
    "library/questionnaires/index.yaml",
    [
      "version: 1",
      "families:",
      "  - id: dotnet-csharp",
      "    flow: dotnet-csharp/install-flow.yaml"
    ].join("\n")
  );

  await writeAssetFile(
    assetRoot,
    "library/questionnaires/dotnet-csharp/install-flow.yaml",
    [
      "version: 1",
      "family: dotnet-csharp",
      "entrypoint: root",
      "nodes:",
      "  - id: root",
      "    type: select",
      "    question: Choose project profile",
      "    options:",
      "      - id: web_api_simple",
      "        label: Web API (Simple)",
      "        next: end",
      "  - id: end",
      "    type: end"
    ].join("\n")
  );

  await writeAssetFile(
    assetRoot,
    "library/profiles/dotnet-csharp/baseline.yaml",
    [
      "version: 1",
      "profile_id: dotnet-csharp-baseline",
      "family: dotnet-csharp",
      "questionnaire_ref: .codex-onboarding/library/questionnaires/dotnet-csharp/install-flow.yaml",
      "baseline_topics: [base-topic]",
      "default_capabilities: [cap.base]"
    ].join("\n")
  );

  await writeAssetFile(
    assetRoot,
    "library/profiles/dotnet-csharp/web-api-simple.yaml",
    [
      "version: 1",
      "profile_id: dotnet-csharp-web-api-simple",
      "family: dotnet-csharp",
      "inherits: dotnet-csharp-baseline",
      "questionnaire_ref: .codex-onboarding/library/questionnaires/dotnet-csharp/install-flow.yaml",
      "baseline_topics: [webapi-topic]",
      "default_capabilities: [cap.webapi]"
    ].join("\n")
  );

  await writeAssetFile(
    assetRoot,
    "library/rules/selector-rules.yaml",
    [
      "version: 1",
      "resolver:",
      "  deterministic_sort:",
      "    - required",
      "    - category",
      "    - file_id",
      "  conflict_resolution:",
      "    strategy: fail_on_required_conflict",
      "    optional_topic_policy: drop_optional_conflicts",
      "  dependency_policy:",
      "    missing_dependency: fail"
    ].join("\n")
  );

  await writeAssetFile(
    assetRoot,
    "library/indexes/topics.index.yaml",
    [
      "version: 1",
      "topics:",
      "  - file_id: base-topic",
      "    path: topics/cross-cutting/base-topic.md",
      "    category: 00-core",
      "    severity: normal",
      "    required: true",
      "    tags: []",
      "    applicability:",
      "      families: [dotnet-csharp]",
      "    requires: []",
      "    conflicts_with: []",
      "  - file_id: webapi-topic",
      "    path: topics/dotnet/csharp/app-types/webapi-topic.md",
      "    category: 10-app",
      "    severity: normal",
      "    required: true",
      "    tags: [answer.root.web_api_simple]",
      "    applicability:",
      "      families: [dotnet-csharp]",
      "    requires: []",
      "    conflicts_with: []"
    ].join("\n")
  );

  await writeAssetFile(
    assetRoot,
    "library/topics/cross-cutting/base-topic.md",
    [
      "<!--",
      "artifact_id: base-topic",
      "managed: true",
      "schema_version: 1",
      "bundle_id: TBD",
      "bundle_version: TBD",
      "extension_version: TBD",
      "-->",
      "",
      "# Base Topic"
    ].join("\n")
  );

  await writeAssetFile(
    assetRoot,
    "library/topics/dotnet/csharp/app-types/webapi-topic.md",
    [
      "<!--",
      "artifact_id: webapi-topic",
      "managed: true",
      "schema_version: 1",
      "bundle_id: TBD",
      "bundle_version: TBD",
      "extension_version: TBD",
      "-->",
      "",
      "# Web API Topic"
    ].join("\n")
  );
}

async function resolveSelection(extensionPath: string) {
  const questionnaire = await loadQuestionnaireAssets(extensionPath, "dotnet-csharp");
  const profile = await loadResolvedProfile(extensionPath, "dotnet-csharp", "web_api_simple");
  const logger = { log: vi.fn() };

  const plan = await resolveSelectionPlan(
    {
      extensionPath,
      family: "dotnet-csharp",
      profileId: profile.profile_id,
      baselineTopicIds: profile.baseline_topics,
      defaultCapabilities: profile.default_capabilities,
      questionAnswers: {
        root: "web_api_simple"
      }
    },
    logger
  );

  return {
    questionnaire,
    profile,
    plan,
    logger
  };
}

describe("scenario-matrix smoke", () => {
  it("S-01 + S-17: first install writes state and includes bootstrap artifact", async () => {
    const fixture = await createFixturePaths("scenario-first-install");
    cleanups.push(fixture.tempRoot);

    await seedSmokeAssets(fixture.assetRoot);

    const { questionnaire, profile, plan } = await resolveSelection(fixture.extensionPath);

    const result = await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: profile.profile_id,
        bundleVersion: String(questionnaire.flow.version),
        extensionVersion: "1.0.0",
        selectedTopics: plan.selected_topics
      },
      { log: vi.fn() }
    );

    expect(result.appliedFiles).toEqual(
      expect.arrayContaining([
        ".codex-onboarding/core/AGENT-ONBOARDING.md",
        ".codex-onboarding/core/topics/cross-cutting/base-topic.md",
        ".codex-onboarding/core/topics/dotnet/csharp/app-types/webapi-topic.md"
      ])
    );

    const stateRaw = await fs.readFile(result.statePath, "utf8");
    const state = JSON.parse(stateRaw) as {
      managed_files: Array<{ relative_path: string }>;
    };

    expect(state.managed_files.map((item) => item.relative_path)).toContain(
      ".codex-onboarding/core/AGENT-ONBOARDING.md"
    );

    await expect(
      fs.readFile(path.join(fixture.targetRoot, ".codex-onboarding/core/AGENT-ONBOARDING.md"), "utf8")
    ).resolves.toContain("bundle_id: dotnet-csharp-web-api-simple");
  });

  it("S-05: drifted tracked managed file blocks update (fail-fast)", async () => {
    const fixture = await createFixturePaths("scenario-drift-failfast");
    cleanups.push(fixture.tempRoot);

    await seedSmokeAssets(fixture.assetRoot);

    const { questionnaire, profile, plan } = await resolveSelection(fixture.extensionPath);

    await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: profile.profile_id,
        bundleVersion: String(questionnaire.flow.version),
        extensionVersion: "1.0.0",
        selectedTopics: plan.selected_topics
      },
      { log: vi.fn() }
    );

    const driftedPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/cross-cutting/base-topic.md"
    );
    await fs.appendFile(driftedPath, "\n# consumer drift\n", "utf8");

    await expect(
      applyManagedInstall(
        {
          extensionPath: fixture.extensionPath,
          targetRootPath: fixture.targetRoot,
          bundleId: profile.profile_id,
          bundleVersion: "2",
          extensionVersion: "1.1.0",
          selectedTopics: plan.selected_topics
        },
        { log: vi.fn() }
      )
    ).rejects.toThrow("Managed drift detected");
  });

  it("S-09: remove keeps modified managed files and clears state", async () => {
    const fixture = await createFixturePaths("scenario-remove");
    cleanups.push(fixture.tempRoot);

    await seedSmokeAssets(fixture.assetRoot);

    const { questionnaire, profile, plan } = await resolveSelection(fixture.extensionPath);

    const installed = await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: profile.profile_id,
        bundleVersion: String(questionnaire.flow.version),
        extensionVersion: "1.0.0",
        selectedTopics: plan.selected_topics
      },
      { log: vi.fn() }
    );

    const modifiedPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/dotnet/csharp/app-types/webapi-topic.md"
    );
    await fs.appendFile(modifiedPath, "\n# consumer edit\n", "utf8");

    const removed = await removeManagedOnboarding(fixture.targetRoot, { log: vi.fn() });

    expect(removed.removedFiles).toContain(".codex-onboarding/core/AGENT-ONBOARDING.md");
    expect(removed.preservedModifiedFiles).toContain(
      ".codex-onboarding/core/topics/dotnet/csharp/app-types/webapi-topic.md"
    );

    await expect(fs.readFile(installed.statePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("S-10: repair reconstructs state and restores missing managed files", async () => {
    const fixture = await createFixturePaths("scenario-repair");
    cleanups.push(fixture.tempRoot);

    await seedSmokeAssets(fixture.assetRoot);

    const { questionnaire, profile, plan } = await resolveSelection(fixture.extensionPath);

    const installed = await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: profile.profile_id,
        bundleVersion: String(questionnaire.flow.version),
        extensionVersion: "1.0.0",
        selectedTopics: plan.selected_topics
      },
      { log: vi.fn() }
    );

    await fs.unlink(installed.statePath);

    const missingPath = path.join(
      fixture.targetRoot,
      ".codex-onboarding/core/topics/cross-cutting/base-topic.md"
    );
    await fs.unlink(missingPath);

    const repaired = await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: profile.profile_id,
        bundleVersion: String(questionnaire.flow.version),
        extensionVersion: "1.0.0",
        selectedTopics: plan.selected_topics,
        mode: "repair"
      },
      { log: vi.fn() }
    );

    expect(repaired.appliedFiles).toContain(".codex-onboarding/core/topics/cross-cutting/base-topic.md");
    expect(repaired.recoveredTrackedFiles).toContain(".codex-onboarding/core/AGENT-ONBOARDING.md");

    await expect(fs.readFile(installed.statePath, "utf8")).resolves.toContain("managed_files");
    await expect(
      fs.readFile(path.join(fixture.targetRoot, ".codex-onboarding/core/AGENT-ONBOARDING.md"), "utf8")
    ).resolves.toContain("managed: true");
  });

  it("S-15: safe downgrade rewrites managed metadata when integrity checks pass", async () => {
    const fixture = await createFixturePaths("scenario-safe-downgrade");
    cleanups.push(fixture.tempRoot);

    await seedSmokeAssets(fixture.assetRoot);

    const { questionnaire, profile, plan } = await resolveSelection(fixture.extensionPath);

    await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: profile.profile_id,
        bundleVersion: "2",
        extensionVersion: "2.0.0",
        selectedTopics: plan.selected_topics
      },
      { log: vi.fn() }
    );

    const downgraded = await applyManagedInstall(
      {
        extensionPath: fixture.extensionPath,
        targetRootPath: fixture.targetRoot,
        bundleId: profile.profile_id,
        bundleVersion: String(questionnaire.flow.version),
        extensionVersion: "1.0.0",
        selectedTopics: plan.selected_topics
      },
      { log: vi.fn() }
    );

    expect(downgraded.appliedFiles).toEqual(
      expect.arrayContaining([
        ".codex-onboarding/core/AGENT-ONBOARDING.md",
        ".codex-onboarding/core/topics/cross-cutting/base-topic.md",
        ".codex-onboarding/core/topics/dotnet/csharp/app-types/webapi-topic.md"
      ])
    );

    const stateRaw = await fs.readFile(downgraded.statePath, "utf8");
    const state = JSON.parse(stateRaw) as {
      bundle_version: string;
      extension_version: string;
    };

    expect(state.bundle_version).toBe(String(questionnaire.flow.version));
    expect(state.extension_version).toBe("1.0.0");

    await expect(
      fs.readFile(path.join(fixture.targetRoot, ".codex-onboarding/core/AGENT-ONBOARDING.md"), "utf8")
    ).resolves.toContain("extension_version: 1.0.0");
  });
});
