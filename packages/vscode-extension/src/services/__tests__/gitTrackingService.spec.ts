import * as fs from "node:fs/promises";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { applyGitTrackingMode } from "../gitTrackingService";
import { cleanupFixture, createFixturePaths } from "../../test-utils/fixtureFactory";

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const root = cleanups.pop();
    if (root) {
      await cleanupFixture(root);
    }
  }
});

describe("applyGitTrackingMode", () => {
  it("adds managed ignore block to .git/info/exclude in ignore mode", async () => {
    const fixture = await createFixturePaths("git-tracking-ignore");
    cleanups.push(fixture.tempRoot);

    await fs.mkdir(path.join(fixture.targetRoot, ".git", "info"), { recursive: true });

    const logger = { log: vi.fn() };
    const result = await applyGitTrackingMode(
      {
        targetRootPath: fixture.targetRoot,
        mode: "ignore"
      },
      logger
    );

    expect(result.strategy).toBe("git_info_exclude");
    expect(result.updated).toBe(true);

    const excludePath = path.join(fixture.targetRoot, ".git", "info", "exclude");
    const content = await fs.readFile(excludePath, "utf8");
    expect(content).toContain(".codex-onboarding/core/");
    expect(content).toContain(".codex-onboarding/.managed/");
  });

  it("is idempotent in ignore mode", async () => {
    const fixture = await createFixturePaths("git-tracking-idempotent");
    cleanups.push(fixture.tempRoot);

    await fs.mkdir(path.join(fixture.targetRoot, ".git", "info"), { recursive: true });

    const logger = { log: vi.fn() };

    const first = await applyGitTrackingMode(
      {
        targetRootPath: fixture.targetRoot,
        mode: "ignore"
      },
      logger
    );
    expect(first.updated).toBe(true);

    const second = await applyGitTrackingMode(
      {
        targetRootPath: fixture.targetRoot,
        mode: "ignore"
      },
      logger
    );
    expect(second.updated).toBe(false);

    const excludePath = path.join(fixture.targetRoot, ".git", "info", "exclude");
    const content = await fs.readFile(excludePath, "utf8");
    expect(content.match(/codex-onboarding managed ignore/g)?.length).toBe(2);
  });

  it("removes managed ignore block in track mode and keeps unrelated entries", async () => {
    const fixture = await createFixturePaths("git-tracking-track");
    cleanups.push(fixture.tempRoot);

    const excludePath = path.join(fixture.targetRoot, ".git", "info", "exclude");
    await fs.mkdir(path.dirname(excludePath), { recursive: true });
    await fs.writeFile(
      excludePath,
      [
        "node_modules/",
        "",
        "# >>> codex-onboarding managed ignore (start) >>>",
        ".codex-onboarding/core/",
        ".codex-onboarding/.managed/",
        "# <<< codex-onboarding managed ignore (end) <<<",
        "",
        "*.tmp"
      ].join("\n"),
      "utf8"
    );

    const logger = { log: vi.fn() };
    const result = await applyGitTrackingMode(
      {
        targetRootPath: fixture.targetRoot,
        mode: "track"
      },
      logger
    );

    expect(result.strategy).toBe("git_info_exclude");
    expect(result.updated).toBe(true);

    const content = await fs.readFile(excludePath, "utf8");
    expect(content).toContain("node_modules/");
    expect(content).toContain("*.tmp");
    expect(content).not.toContain(".codex-onboarding/core/");
    expect(content).not.toContain(".codex-onboarding/.managed/");
  });

  it("skips when workspace root is not a git repository", async () => {
    const fixture = await createFixturePaths("git-tracking-no-git");
    cleanups.push(fixture.tempRoot);

    const logger = { log: vi.fn() };
    const result = await applyGitTrackingMode(
      {
        targetRootPath: fixture.targetRoot,
        mode: "ignore"
      },
      logger
    );

    expect(result.strategy).toBe("no_git_repository");
    expect(result.updated).toBe(false);
  });

  it("supports .git pointer files (worktree style)", async () => {
    const fixture = await createFixturePaths("git-tracking-pointer");
    cleanups.push(fixture.tempRoot);

    const externalGitDir = path.join(fixture.tempRoot, "git-dir");
    await fs.mkdir(path.join(externalGitDir, "info"), { recursive: true });
    await fs.writeFile(path.join(fixture.targetRoot, ".git"), "gitdir: ../git-dir\n", "utf8");

    const logger = { log: vi.fn() };
    const result = await applyGitTrackingMode(
      {
        targetRootPath: fixture.targetRoot,
        mode: "ignore"
      },
      logger
    );

    expect(result.strategy).toBe("git_info_exclude");
    expect(result.excludePath).toBe(path.join(externalGitDir, "info", "exclude"));
    await expect(fs.readFile(path.join(externalGitDir, "info", "exclude"), "utf8")).resolves.toContain(
      ".codex-onboarding/core/"
    );
  });
});
