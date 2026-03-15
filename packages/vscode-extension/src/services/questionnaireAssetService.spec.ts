import * as fs from "node:fs/promises";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { cleanupFixture, createFixturePaths, writeAssetFile } from "../test-utils/fixtureFactory";
import { loadQuestionnaireAssets, loadQuestionnaireCatalog } from "./questionnaireAssetService";

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const root = cleanups.pop();
    if (root) {
      await cleanupFixture(root);
    }
  }
});

describe("questionnaireAssetService", () => {
  it("loads questionnaire catalog from index registry", async () => {
    const fixture = await createFixturePaths("questionnaire-catalog");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/questionnaires/index.yaml",
      [
        "version: 1",
        "families:",
        "  dotnet-csharp:",
        "    install_flow: .codex-onboarding/library/questionnaires/dotnet-csharp/install-flow.yaml",
        "  python:",
        "    install_flow: .codex-onboarding/library/questionnaires/python/install-flow.yaml"
      ].join("\n")
    );

    const catalog = await loadQuestionnaireCatalog(fixture.extensionPath);
    expect(catalog.version).toBe(1);
    expect(catalog.families.map((item) => item.family)).toEqual(["dotnet-csharp", "python"]);
    expect(catalog.families[0]?.installFlowRelativePath).toBe(
      "library/questionnaires/dotnet-csharp/install-flow.yaml"
    );
  });

  it("resolves install_flow path from registry when loading family questionnaire", async () => {
    const fixture = await createFixturePaths("questionnaire-assets");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/questionnaires/index.yaml",
      [
        "version: 1",
        "families:",
        "  dotnet-csharp:",
        "    install_flow: .codex-onboarding/library/questionnaires/dotnet-csharp/install-flow.yaml"
      ].join("\n")
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/questionnaires/dotnet-csharp/install-flow.yaml",
      [
        "version: 7",
        "family: dotnet-csharp",
        "entrypoint: root",
        "nodes:",
        "  - id: root",
        "    type: select",
        "    question: Pick profile",
        "    options:",
        "      - id: web_api_simple",
        "        label: Web API",
        "        next: end",
        "  - id: end",
        "    type: end"
      ].join("\n")
    );

    const loaded = await loadQuestionnaireAssets(fixture.extensionPath, "dotnet-csharp");
    expect(loaded.family).toBe("dotnet-csharp");
    expect(loaded.flow.version).toBe(7);
    expect(loaded.flow.family).toBe("dotnet-csharp");
    expect(loaded.flowPath.endsWith(path.join("library", "questionnaires", "dotnet-csharp", "install-flow.yaml"))).toBe(true);
  });

  it("fails fast when index entry for requested family is missing", async () => {
    const fixture = await createFixturePaths("questionnaire-assets-missing-family");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/questionnaires/index.yaml",
      [
        "version: 1",
        "families:",
        "  python:",
        "    install_flow: .codex-onboarding/library/questionnaires/python/install-flow.yaml"
      ].join("\n")
    );

    await expect(
      loadQuestionnaireAssets(fixture.extensionPath, "dotnet-csharp")
    ).rejects.toThrow(/not listed in questionnaires index/i);
  });

  it("fails fast on invalid questionnaire index shape", async () => {
    const fixture = await createFixturePaths("questionnaire-assets-invalid-index");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/questionnaires/index.yaml",
      [
        "version: 1",
        "families:",
        "  - id: dotnet-csharp",
        "    flow: dotnet-csharp/install-flow.yaml"
      ].join("\n")
    );

    await expect(loadQuestionnaireCatalog(fixture.extensionPath)).rejects.toThrow(
      /invalid questionnaires index entry/i
    );
  });

  it("normalizes install_flow paths with ./ prefix", async () => {
    const fixture = await createFixturePaths("questionnaire-assets-dot-slash");
    cleanups.push(fixture.tempRoot);

    await writeAssetFile(
      fixture.assetRoot,
      "library/questionnaires/index.yaml",
      [
        "version: 1",
        "families:",
        "  dotnet-csharp:",
        "    install_flow: ./library/questionnaires/dotnet-csharp/install-flow.yaml"
      ].join("\n")
    );
    await writeAssetFile(
      fixture.assetRoot,
      "library/questionnaires/dotnet-csharp/install-flow.yaml",
      [
        "version: 1",
        "family: dotnet-csharp",
        "entrypoint: end",
        "nodes:",
        "  - id: end",
        "    type: end"
      ].join("\n")
    );

    const loaded = await loadQuestionnaireAssets(fixture.extensionPath, "dotnet-csharp");
    await expect(fs.access(loaded.flowPath)).resolves.toBeUndefined();
    expect(loaded.flow.entrypoint).toBe("end");
  });
});
