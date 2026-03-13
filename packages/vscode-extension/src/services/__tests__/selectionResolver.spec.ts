import { afterEach, describe, expect, it, vi } from "vitest";

import { loadResolvedProfile } from "../profileAssetService";
import { resolveSelectionPlan } from "../selectionResolver";
import {
  cleanupFixture,
  createFixturePaths,
  writeAssetFile
} from "../../test-utils/fixtureFactory";

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const root = cleanups.pop();
    if (root) {
      await cleanupFixture(root);
    }
  }
});

function buildProfileYaml(params: {
  profileId: string;
  family: string;
  inherits?: string;
  baselineTopics: string[];
  capabilities: string[];
}): string {
  return [
    "version: 1",
    `profile_id: ${params.profileId}`,
    `family: ${params.family}`,
    params.inherits ? `inherits: ${params.inherits}` : "",
    "questionnaire_ref: codex-onboarding/library/questionnaires/dotnet-csharp/install-flow.yaml",
    `baseline_topics: [${params.baselineTopics.join(", ")}]`,
    `default_capabilities: [${params.capabilities.join(", ")}]`
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRulesYaml(): string {
  return [
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
  ].join("\n");
}

describe("profile + selection resolution", () => {
  it("merges inherited profile metadata and resolves deterministic selection with dependency/conflict rules", async () => {
    const fixture = await createFixturePaths("selection-resolver");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/baseline.yaml",
      buildProfileYaml({
        profileId: "dotnet-csharp-baseline",
        family: "dotnet-csharp",
        baselineTopics: ["base-topic"],
        capabilities: ["cap.base"]
      })
    );

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/web-api-simple.yaml",
      buildProfileYaml({
        profileId: "dotnet-csharp-web-api-simple",
        family: "dotnet-csharp",
        inherits: "dotnet-csharp-baseline",
        baselineTopics: ["webapi-topic"],
        capabilities: ["cap.webapi"]
      })
    );

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      buildRulesYaml()
    );

    await writeAssetFile(
      fixture.assetRoot,
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
        "    tags: []",
        "    applicability:",
        "      families: [dotnet-csharp]",
        "    requires: []",
        "    conflicts_with: []",
        "  - file_id: cap-topic",
        "    path: topics/dotnet/csharp/app-types/cap-topic.md",
        "    category: 10-app",
        "    severity: normal",
        "    required: false",
        "    tags: [answer.root.web_api_simple]",
        "    applicability:",
        "      families: [dotnet-csharp]",
        "    requires: [dep-topic]",
        "    conflicts_with: [opt-conflict-topic]",
        "  - file_id: dep-topic",
        "    path: topics/cross-cutting/dep-topic.md",
        "    category: 05-shared",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability:",
        "      families: [dotnet-csharp]",
        "    requires: []",
        "    conflicts_with: []",
        "  - file_id: opt-conflict-topic",
        "    path: topics/cross-cutting/opt-conflict-topic.md",
        "    category: 05-shared",
        "    severity: normal",
        "    required: false",
        "    tags: [answer.root.web_api_simple]",
        "    applicability:",
        "      families: [dotnet-csharp]",
        "    requires: []",
        "    conflicts_with: [cap-topic]"
      ].join("\n")
    );

    const profile = await loadResolvedProfile(
      fixture.extensionPath,
      "dotnet-csharp",
      "web_api_simple"
    );

    expect(profile.profile_id).toBe("dotnet-csharp-web-api-simple");
    expect(profile.baseline_topics).toEqual(expect.arrayContaining(["base-topic", "webapi-topic"]));
    expect(profile.default_capabilities).toEqual(expect.arrayContaining(["cap.base", "cap.webapi"]));

    const logger = { log: vi.fn() };
    const plan = await resolveSelectionPlan(
      {
        extensionPath: fixture.extensionPath,
        family: "dotnet-csharp",
        profileId: profile.profile_id,
        baselineTopicIds: profile.baseline_topics,
        defaultCapabilities: profile.default_capabilities,
        questionAnswers: { root: "web_api_simple" }
      },
      logger
    );

    const ids = plan.selected_topics.map((item) => item.file_id);

    expect(ids).toContain("base-topic");
    expect(ids).toContain("cap-topic");
    expect(ids).toContain("dep-topic");
    expect(ids).not.toContain("opt-conflict-topic");
    expect(ids[0]).toBe("base-topic");
  });

  it("drops optional topic when it conflicts with a required topic", async () => {
    const fixture = await createFixturePaths("selection-optional-vs-required");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      buildRulesYaml()
    );

    await writeAssetFile(
      fixture.assetRoot,
      "library/indexes/topics.index.yaml",
      [
        "version: 1",
        "topics:",
        "  - file_id: optional-topic",
        "    path: topics/cross-cutting/optional-topic.md",
        "    category: 20-optional",
        "    severity: normal",
        "    required: false",
        "    tags: [answer.root.web_api_simple]",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: [required-topic]",
        "  - file_id: required-topic",
        "    path: topics/cross-cutting/required-topic.md",
        "    category: 00-core",
        "    severity: normal",
        "    required: true",
        "    tags: [answer.root.web_api_simple]",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: [optional-topic]"
      ].join("\n")
    );

    const logger = { log: vi.fn() };

    const plan = await resolveSelectionPlan(
      {
        extensionPath: fixture.extensionPath,
        family: "dotnet-csharp",
        profileId: "x",
        baselineTopicIds: [],
        defaultCapabilities: [],
        questionAnswers: { root: "web_api_simple" }
      },
      logger
    );

    const ids = plan.selected_topics.map((item) => item.file_id);

    expect(ids).toContain("required-topic");
    expect(ids).not.toContain("optional-topic");
  });

  it("fails when dependency is missing and policy is fail", async () => {
    const fixture = await createFixturePaths("selection-missing-dep");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      buildRulesYaml()
    );

    await writeAssetFile(
      fixture.assetRoot,
      "library/indexes/topics.index.yaml",
      [
        "version: 1",
        "topics:",
        "  - file_id: only-topic",
        "    path: topics/cross-cutting/only-topic.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: [missing-topic]",
        "    conflicts_with: []"
      ].join("\n")
    );

    const logger = { log: vi.fn() };

    await expect(
      resolveSelectionPlan(
        {
          extensionPath: fixture.extensionPath,
          family: "dotnet-csharp",
          profileId: "x",
          baselineTopicIds: [],
          defaultCapabilities: [],
          questionAnswers: {}
        },
        logger
      )
    ).rejects.toThrow("Missing required dependency");
  });

  it("fails on required conflict when strategy is fail_on_required_conflict", async () => {
    const fixture = await createFixturePaths("selection-required-conflict");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      buildRulesYaml()
    );

    await writeAssetFile(
      fixture.assetRoot,
      "library/indexes/topics.index.yaml",
      [
        "version: 1",
        "topics:",
        "  - file_id: required-a",
        "    path: topics/cross-cutting/required-a.md",
        "    category: core",
        "    severity: normal",
        "    required: true",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: [required-b]",
        "  - file_id: required-b",
        "    path: topics/cross-cutting/required-b.md",
        "    category: core",
        "    severity: normal",
        "    required: true",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: [required-a]"
      ].join("\n")
    );

    const logger = { log: vi.fn() };

    await expect(
      resolveSelectionPlan(
        {
          extensionPath: fixture.extensionPath,
          family: "dotnet-csharp",
          profileId: "x",
          baselineTopicIds: [],
          defaultCapabilities: [],
          questionAnswers: {}
        },
        logger
      )
    ).rejects.toThrow("Required conflict detected");
  });
});
