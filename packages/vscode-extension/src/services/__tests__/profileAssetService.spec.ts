import { afterEach, describe, expect, it } from "vitest";

import { loadResolvedProfile } from "../profileAssetService";
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

function profileYaml(params: {
  profileId: string;
  family: string;
  inherits?: string;
  baselineTopics: string[];
  defaultCapabilities: string[];
  questionnaireRef?: string;
}): string {
  return [
    "version: 1",
    `profile_id: ${params.profileId}`,
    `family: ${params.family}`,
    params.inherits ? `inherits: ${params.inherits}` : "",
    `questionnaire_ref: ${params.questionnaireRef ?? "library/questionnaires/x.yaml"}`,
    `baseline_topics: [${params.baselineTopics.join(", ")}]`,
    `default_capabilities: [${params.defaultCapabilities.join(", ")}]`
  ]
    .filter(Boolean)
    .join("\n");
}

describe("loadResolvedProfile", () => {
  it("loads direct profile when inherits is not set", async () => {
    const fixture = await createFixturePaths("profile-direct");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/web-api-simple.yaml",
      profileYaml({
        profileId: "dotnet-csharp-web-api-simple",
        family: "dotnet-csharp",
        baselineTopics: ["base-topic"],
        defaultCapabilities: ["cap.a"]
      })
    );

    const profile = await loadResolvedProfile(
      fixture.extensionPath,
      "dotnet-csharp",
      "web_api_simple"
    );

    expect(profile.profile_id).toBe("dotnet-csharp-web-api-simple");
    expect(profile.baseline_topics).toEqual(["base-topic"]);
  });

  it("throws when profile definition is invalid", async () => {
    const fixture = await createFixturePaths("profile-invalid-doc");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/web-api-simple.yaml",
      [
        "version: 1",
        "profile_id: dotnet-csharp-web-api-simple",
        "family: dotnet-csharp",
        "questionnaire_ref: library/questionnaires/x.yaml",
        "baseline_topics: [base-topic]"
      ].join("\n")
    );

    await expect(
      loadResolvedProfile(fixture.extensionPath, "dotnet-csharp", "web_api_simple")
    ).rejects.toThrow("Invalid profile definition document");
  });

  it("throws when inherits has invalid type", async () => {
    const fixture = await createFixturePaths("profile-invalid-inherits");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/web-api-simple.yaml",
      [
        "version: 1",
        "profile_id: dotnet-csharp-web-api-simple",
        "family: dotnet-csharp",
        "inherits: 123",
        "questionnaire_ref: library/questionnaires/x.yaml",
        "baseline_topics: [base-topic]",
        "default_capabilities: [cap.a]"
      ].join("\n")
    );

    await expect(
      loadResolvedProfile(fixture.extensionPath, "dotnet-csharp", "web_api_simple")
    ).rejects.toThrow("'inherits' must be string");
  });

  it("throws when selected profile family mismatches requested family", async () => {
    const fixture = await createFixturePaths("profile-family-mismatch");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/web-api-simple.yaml",
      profileYaml({
        profileId: "dotnet-csharp-web-api-simple",
        family: "python",
        baselineTopics: ["base-topic"],
        defaultCapabilities: ["cap.a"]
      })
    );

    await expect(
      loadResolvedProfile(fixture.extensionPath, "dotnet-csharp", "web_api_simple")
    ).rejects.toThrow("Profile family mismatch");
  });

  it("throws when inherited base profile family mismatches requested family", async () => {
    const fixture = await createFixturePaths("profile-base-family-mismatch");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/web-api-simple.yaml",
      profileYaml({
        profileId: "dotnet-csharp-web-api-simple",
        family: "dotnet-csharp",
        inherits: "dotnet-csharp-baseline",
        baselineTopics: ["web-topic"],
        defaultCapabilities: ["cap.web"]
      })
    );

    await writeAssetFile(
      fixture.assetRoot,
      "library/profiles/dotnet-csharp/baseline.yaml",
      profileYaml({
        profileId: "dotnet-csharp-baseline",
        family: "python",
        baselineTopics: ["base-topic"],
        defaultCapabilities: ["cap.base"]
      })
    );

    await expect(
      loadResolvedProfile(fixture.extensionPath, "dotnet-csharp", "web_api_simple")
    ).rejects.toThrow("Base profile family mismatch");
  });
});
