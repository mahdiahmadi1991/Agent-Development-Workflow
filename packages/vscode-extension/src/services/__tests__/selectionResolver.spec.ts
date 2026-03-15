import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { loadResolvedProfile, resolveProfileFromHints } from "../profileAssetService";
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
    "questionnaire_ref: .codex-onboarding/library/questionnaires/dotnet-csharp/install-flow.yaml",
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
        questionAnswers: { root: ["web_api_simple"] }
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
        questionAnswers: { root: ["web_api_simple"] }
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

  it("continues when dependency is missing and policy is non-fail", async () => {
    const fixture = await createFixturePaths("selection-missing-dep-nonfail");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
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
        "    missing_dependency: ignore"
      ].join("\n")
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

    const plan = await resolveSelectionPlan(
      {
        extensionPath: fixture.extensionPath,
        family: "dotnet-csharp",
        profileId: "x",
        baselineTopicIds: [],
        defaultCapabilities: [],
        questionAnswers: {}
      },
      logger
    );

    expect(plan.selected_topics.map((item) => item.file_id)).toContain("only-topic");
  });

  it("drops optional conflict when required topic is processed first", async () => {
    const fixture = await createFixturePaths("selection-required-drops-optional");
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
        "  - file_id: required-topic",
        "    path: topics/cross-cutting/required-topic.md",
        "    category: 00-core",
        "    severity: normal",
        "    required: true",
        "    tags: [answer.root.web_api_simple]",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: [optional-topic]",
        "  - file_id: optional-topic",
        "    path: topics/cross-cutting/optional-topic.md",
        "    category: 20-optional",
        "    severity: normal",
        "    required: false",
        "    tags: [answer.root.web_api_simple]",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: [required-topic]"
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
        questionAnswers: { root: ["web_api_simple"] }
      },
      logger
    );

    const ids = plan.selected_topics.map((item) => item.file_id);
    expect(ids).toContain("required-topic");
    expect(ids).not.toContain("optional-topic");
  });

  it("treats non-array applicability families as compatible", async () => {
    const fixture = await createFixturePaths("selection-applicability-non-array");
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
        "  - file_id: odd-applicability-topic",
        "    path: topics/cross-cutting/odd.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability:",
        "      families: unexpected",
        "    requires: []",
        "    conflicts_with: []"
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
        questionAnswers: {}
      },
      logger
    );

    expect(plan.selected_topics.map((item) => item.file_id)).toContain("odd-applicability-topic");
  });

  it("skips non-matching capability topics and still adds missing dependencies", async () => {
    const fixture = await createFixturePaths("selection-capability-skip-and-dependency-add");
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
        "  - file_id: trigger-topic",
        "    path: topics/cross-cutting/trigger.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: [answer.root.enable]",
        "    applicability: {}",
        "    requires: [dep-topic]",
        "    conflicts_with: []",
        "  - file_id: dep-topic",
        "    path: topics/cross-cutting/dep.md",
        "    category: shared",
        "    severity: normal",
        "    required: false",
        "    tags: [cap.never-selected-directly]",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: []",
        "  - file_id: skipped-topic",
        "    path: topics/cross-cutting/skipped.md",
        "    category: shared",
        "    severity: normal",
        "    required: false",
        "    tags: [answer.root.never]",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: []"
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
        questionAnswers: { root: ["enable"] }
      },
      logger
    );

    const ids = plan.selected_topics.map((item) => item.file_id);
    expect(ids).toContain("trigger-topic");
    expect(ids).toContain("dep-topic");
    expect(ids).not.toContain("skipped-topic");
  });

  it("builds a composed profile id when multiple hints are selected", async () => {
    const fixture = await createFixturePaths("profile-composed-id");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/first.yaml",
      buildProfileYaml({
        profileId: "dotnet-csharp-first",
        family: "dotnet-csharp",
        baselineTopics: ["t1"],
        capabilities: ["cap.first"]
      })
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/second.yaml",
      buildProfileYaml({
        profileId: "dotnet-csharp-second",
        family: "dotnet-csharp",
        baselineTopics: ["t2"],
        capabilities: ["cap.second"]
      })
    );

    const resolved = await resolveProfileFromHints(
      fixture.extensionPath,
      "dotnet-csharp",
      ["first", "second"]
    );

    expect(resolved.profile_id).toBe("dotnet-csharp-composed-first+second");
    expect(resolved.baseline_topics).toEqual(expect.arrayContaining(["t1", "t2"]));
  });

  it("resolves prefixed hint without rewriting when family prefix already exists", async () => {
    const fixture = await createFixturePaths("profile-prefixed-hint");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/alpha.yaml",
      buildProfileYaml({
        profileId: "dotnet-csharp-alpha",
        family: "dotnet-csharp",
        baselineTopics: ["alpha-topic"],
        capabilities: ["cap.alpha"]
      })
    );

    const resolved = await resolveProfileFromHints(
      fixture.extensionPath,
      "dotnet-csharp",
      ["dotnet-csharp-alpha"]
    );

    expect(resolved.profile_id).toBe("dotnet-csharp-alpha");
  });

  it("throws when no profile definitions exist for selected family", async () => {
    const fixture = await createFixturePaths("profile-missing-family");
    cleanups.push(fixture.tempRoot);
    await fs.mkdir(
      path.join(
        fixture.assetRoot,
        "library",
        "profiles",
        "dotnet-csharp"
      ),
      { recursive: true }
    );

    await expect(
      resolveProfileFromHints(fixture.extensionPath, "dotnet-csharp", ["anything"])
    ).rejects.toThrow("No profile definitions found for family 'dotnet-csharp'.");
  });

  it("falls back to first loaded profile when hints do not match and baseline is absent", async () => {
    const fixture = await createFixturePaths("profile-fallback-first-loaded");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/alpha.yaml",
      buildProfileYaml({
        profileId: "dotnet-csharp-alpha",
        family: "dotnet-csharp",
        baselineTopics: ["alpha-topic"],
        capabilities: ["cap.alpha"]
      })
    );

    const resolved = await resolveProfileFromHints(
      fixture.extensionPath,
      "dotnet-csharp",
      ["does-not-exist"]
    );

    expect(resolved.profile_id).toBe("dotnet-csharp-alpha");
    expect(resolved.baseline_topics).toContain("alpha-topic");
  });

  it("throws when inherited base profile family does not match requested family", async () => {
    const fixture = await createFixturePaths("profile-inherited-family-mismatch");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/baseline.yaml",
      buildProfileYaml({
        profileId: "dotnet-csharp-baseline",
        family: "python",
        baselineTopics: ["base-topic"],
        capabilities: ["cap.base"]
      })
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/web-api.yaml",
      buildProfileYaml({
        profileId: "dotnet-csharp-web-api",
        family: "dotnet-csharp",
        inherits: "dotnet-csharp-baseline",
        baselineTopics: ["web-topic"],
        capabilities: ["cap.web"]
      })
    );

    await expect(
      resolveProfileFromHints(fixture.extensionPath, "dotnet-csharp", ["web-api"])
    ).rejects.toThrow("Profile family mismatch");
  });

  it("throws when baseline topic id is not found in topics index", async () => {
    const fixture = await createFixturePaths("selection-baseline-topic-missing");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      buildRulesYaml()
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/indexes/topics.index.yaml",
      ["version: 1", "topics: []"].join("\n")
    );

    const logger = { log: vi.fn() };
    await expect(
      resolveSelectionPlan(
        {
          extensionPath: fixture.extensionPath,
          family: "dotnet-csharp",
          profileId: "x",
          baselineTopicIds: ["missing-baseline"],
          defaultCapabilities: [],
          questionAnswers: {}
        },
        logger
      )
    ).rejects.toThrow("Baseline topic 'missing-baseline' not found");
  });

  it("skips topics whose applicability family does not match current family", async () => {
    const fixture = await createFixturePaths("selection-family-applicability-skip");
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
        "  - file_id: python-only",
        "    path: topics/cross-cutting/python-only.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability:",
        "      families: [python]",
        "    requires: []",
        "    conflicts_with: []"
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
        questionAnswers: {}
      },
      logger
    );

    expect(plan.selected_topics).toHaveLength(0);
  });

  it("fails when topics index root is not an object", async () => {
    const fixture = await createFixturePaths("selection-invalid-topics-root");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      buildRulesYaml()
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/indexes/topics.index.yaml",
      "- not-an-object"
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
    ).rejects.toThrow("Invalid topics index document.");
  });

  it("fails when topic entry shape is invalid", async () => {
    const fixture = await createFixturePaths("selection-invalid-topic-entry");
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
        "  - file_id: broken-topic",
        "    path: topics/cross-cutting/broken.md",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
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
    ).rejects.toThrow("Invalid topic index entry shape.");
  });

  it("fails when selector rules root is invalid", async () => {
    const fixture = await createFixturePaths("selection-invalid-rules-root");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      "version: 1"
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/indexes/topics.index.yaml",
      ["version: 1", "topics: []"].join("\n")
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
    ).rejects.toThrow("Invalid selector rules document.");
  });

  it("fails when selector resolver rules shape is invalid", async () => {
    const fixture = await createFixturePaths("selection-invalid-resolver-shape");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      [
        "version: 1",
        "resolver:",
        "  deterministic_sort: invalid",
        "  conflict_resolution:",
        "    strategy: fail_on_required_conflict",
        "    optional_topic_policy: drop_optional_conflicts",
        "  dependency_policy:",
        "    missing_dependency: fail"
      ].join("\n")
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/indexes/topics.index.yaml",
      ["version: 1", "topics: []"].join("\n")
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
    ).rejects.toThrow("Invalid selector resolver rules shape.");
  });

  it("fails when resolver field is non-object and asRecord guard rejects it", async () => {
    const fixture = await createFixturePaths("selection-invalid-resolver-as-record");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      ["version: 1", "resolver: invalid"].join("\n")
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/indexes/topics.index.yaml",
      ["version: 1", "topics: []"].join("\n")
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
    ).rejects.toThrow("Expected object value.");
  });

  it("sorts by file_id when deterministic_sort includes file_id", async () => {
    const fixture = await createFixturePaths("selection-sort-file-id");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      [
        "version: 1",
        "resolver:",
        "  deterministic_sort:",
        "    - file_id",
        "  conflict_resolution:",
        "    strategy: fail_on_required_conflict",
        "    optional_topic_policy: drop_optional_conflicts",
        "  dependency_policy:",
        "    missing_dependency: ignore"
      ].join("\n")
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/indexes/topics.index.yaml",
      [
        "version: 1",
        "topics:",
        "  - file_id: z-topic",
        "    path: topics/cross-cutting/z.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: []",
        "  - file_id: a-topic",
        "    path: topics/cross-cutting/a.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: []"
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
        questionAnswers: {}
      },
      logger
    );

    expect(plan.selected_topics.map((item) => item.file_id)).toEqual(["a-topic", "z-topic"]);
  });

  it("sorts required topics ahead when left side is optional (required sort branch +1)", async () => {
    const fixture = await createFixturePaths("selection-sort-required-branch-plus");
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
        "    path: topics/cross-cutting/optional.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: []",
        "  - file_id: required-topic",
        "    path: topics/cross-cutting/required.md",
        "    category: core",
        "    severity: normal",
        "    required: true",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: []"
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
        questionAnswers: {}
      },
      logger
    );

    expect(plan.selected_topics.map((item) => item.file_id)[0]).toBe("required-topic");
  });

  it("keeps relative order when deterministic_sort omits file_id and category ties", async () => {
    const fixture = await createFixturePaths("selection-sort-return-zero");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      [
        "version: 1",
        "resolver:",
        "  deterministic_sort:",
        "    - required",
        "    - category",
        "  conflict_resolution:",
        "    strategy: fail_on_required_conflict",
        "    optional_topic_policy: drop_optional_conflicts",
        "  dependency_policy:",
        "    missing_dependency: ignore"
      ].join("\n")
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/indexes/topics.index.yaml",
      [
        "version: 1",
        "topics:",
        "  - file_id: first-topic",
        "    path: topics/cross-cutting/first.md",
        "    category: same",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: []",
        "  - file_id: second-topic",
        "    path: topics/cross-cutting/second.md",
        "    category: same",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: []"
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
        questionAnswers: {}
      },
      logger
    );

    expect(plan.selected_topics.map((item) => item.file_id)).toEqual(["first-topic", "second-topic"]);
  });

  it("ignores unknown conflict targets that are not selected", async () => {
    const fixture = await createFixturePaths("selection-conflict-target-missing");
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
        "  - file_id: base-topic",
        "    path: topics/cross-cutting/base.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: [not-selected-topic]"
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
        questionAnswers: {}
      },
      logger
    );

    expect(plan.selected_topics.map((item) => item.file_id)).toContain("base-topic");
  });

  it("does not throw required conflict when strategy is not fail_on_required_conflict", async () => {
    const fixture = await createFixturePaths("selection-required-conflict-non-fail");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/rules/selector-rules.yaml",
      [
        "version: 1",
        "resolver:",
        "  deterministic_sort:",
        "    - required",
        "    - category",
        "    - file_id",
        "  conflict_resolution:",
        "    strategy: ignore_required_conflict",
        "    optional_topic_policy: drop_optional_conflicts",
        "  dependency_policy:",
        "    missing_dependency: ignore"
      ].join("\n")
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
    const plan = await resolveSelectionPlan(
      {
        extensionPath: fixture.extensionPath,
        family: "dotnet-csharp",
        profileId: "x",
        baselineTopicIds: [],
        defaultCapabilities: [],
        questionAnswers: {}
      },
      logger
    );

    expect(plan.selected_topics.map((item) => item.file_id)).toEqual(["required-a", "required-b"]);
  });

  it("keeps conflicts untouched when optional conflict drop policy is disabled", async () => {
    const fixture = await createFixturePaths("selection-optional-policy-disabled");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
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
        "    optional_topic_policy: keep_optional_conflicts",
        "  dependency_policy:",
        "    missing_dependency: ignore"
      ].join("\n")
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/indexes/topics.index.yaml",
      [
        "version: 1",
        "topics:",
        "  - file_id: left-topic",
        "    path: topics/cross-cutting/left.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: [right-topic]",
        "  - file_id: right-topic",
        "    path: topics/cross-cutting/right.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: [left-topic]"
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
        questionAnswers: {}
      },
      logger
    );

    expect(plan.selected_topics.map((item) => item.file_id)).toEqual(["left-topic", "right-topic"]);
  });

  it("drops lexicographically-later optional topic when optional conflicts are compared", async () => {
    const fixture = await createFixturePaths("selection-optional-conflict-lexicographic");
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
        "  - file_id: aaa-topic",
        "    path: topics/cross-cutting/aaa.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: [zzz-topic]",
        "  - file_id: zzz-topic",
        "    path: topics/cross-cutting/zzz.md",
        "    category: core",
        "    severity: normal",
        "    required: false",
        "    tags: []",
        "    applicability: {}",
        "    requires: []",
        "    conflicts_with: [aaa-topic]"
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
        questionAnswers: {}
      },
      logger
    );

    expect(plan.selected_topics.map((item) => item.file_id)).toEqual(["aaa-topic"]);
  });
});
