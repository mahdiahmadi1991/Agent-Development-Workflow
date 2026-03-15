import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ONBOARDING_INDEX_REFERENCE,
  ROOT_AGENTS_POINTER_SNIPPET,
  applyRootAgentsIntegration,
  inspectRootAgentsIntegration,
  removeRootAgentsIntegration
} from "../rootAgentsIntegrationService";

async function createTempRoot(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const root = cleanups.pop();
    if (root) {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
});

describe("rootAgentsIntegrationService", () => {
  it("creates root AGENTS.md when file does not exist", async () => {
    const root = await createTempRoot("root-agents-create");
    cleanups.push(root);

    const inspection = await inspectRootAgentsIntegration(root);
    const logger = { log: vi.fn() };

    const result = await applyRootAgentsIntegration(
      {
        inspection,
        permission: "auto_create"
      },
      logger
    );

    expect(result.status).toBe("created");

    const rootAgentsPath = path.join(root, "AGENTS.md");
    const content = await fs.readFile(rootAgentsPath, "utf8");
    expect(content).toContain("# AGENTS.md");
    expect(content).toContain(ONBOARDING_INDEX_REFERENCE);
  });

  it("updates existing root AGENTS.md when user allows edit", async () => {
    const root = await createTempRoot("root-agents-update");
    cleanups.push(root);

    const rootAgentsPath = path.join(root, "AGENTS.md");
    await fs.writeFile(rootAgentsPath, "# Existing\n", "utf8");

    const inspection = await inspectRootAgentsIntegration(root);
    const logger = { log: vi.fn() };

    const result = await applyRootAgentsIntegration(
      {
        inspection,
        permission: "allow_edit"
      },
      logger
    );

    expect(result.status).toBe("updated");

    const content = await fs.readFile(rootAgentsPath, "utf8");
    expect(content).toContain("# Existing");
    expect(content).toContain(ROOT_AGENTS_POINTER_SNIPPET.trim());
  });

  it("skips updating root AGENTS.md and returns snippet when user declines", async () => {
    const root = await createTempRoot("root-agents-skip");
    cleanups.push(root);

    const rootAgentsPath = path.join(root, "AGENTS.md");
    await fs.writeFile(rootAgentsPath, "# Existing\n", "utf8");

    const inspection = await inspectRootAgentsIntegration(root);
    const logger = { log: vi.fn() };

    const result = await applyRootAgentsIntegration(
      {
        inspection,
        permission: "deny_edit"
      },
      logger
    );

    expect(result.status).toBe("skipped_user_declined");
    expect(result.manualSnippet).toContain(ONBOARDING_INDEX_REFERENCE);

    const content = await fs.readFile(rootAgentsPath, "utf8");
    expect(content).toBe("# Existing\n");
  });

  it("does not duplicate pointer when root AGENTS.md already references onboarding index", async () => {
    const root = await createTempRoot("root-agents-already");
    cleanups.push(root);

    const rootAgentsPath = path.join(root, "AGENTS.md");
    await fs.writeFile(
      rootAgentsPath,
      `# Existing\n\nRead \`${ONBOARDING_INDEX_REFERENCE}\` first.\n`,
      "utf8"
    );

    const inspection = await inspectRootAgentsIntegration(root);
    const logger = { log: vi.fn() };

    const result = await applyRootAgentsIntegration(
      {
        inspection,
        permission: "allow_edit"
      },
      logger
    );

    expect(result.status).toBe("already_referenced");
    const content = await fs.readFile(rootAgentsPath, "utf8");
    expect(content.match(/\.codex-onboarding\/INDEX\.md/g)?.length).toBe(1);
  });

  it("removes managed pointer snippet from root AGENTS.md", async () => {
    const root = await createTempRoot("root-agents-clean-managed");
    cleanups.push(root);

    const rootAgentsPath = path.join(root, "AGENTS.md");
    await fs.writeFile(
      rootAgentsPath,
      ["# Existing", "", ROOT_AGENTS_POINTER_SNIPPET, "## Team Rules", "- Keep tests green", ""].join("\n"),
      "utf8"
    );

    const logger = { log: vi.fn() };
    const result = await removeRootAgentsIntegration(root, logger);

    expect(result.status).toBe("removed");

    const content = await fs.readFile(rootAgentsPath, "utf8");
    expect(content).toContain("# Existing");
    expect(content).toContain("## Team Rules");
    expect(content).not.toContain("Codex Onboarding Extension Reference");
    expect(content).not.toContain(ONBOARDING_INDEX_REFERENCE);
  });

  it("returns no_pointer_found when root AGENTS.md has no managed snippet", async () => {
    const root = await createTempRoot("root-agents-clean-none");
    cleanups.push(root);

    const rootAgentsPath = path.join(root, "AGENTS.md");
    await fs.writeFile(rootAgentsPath, "# Existing\n", "utf8");

    const logger = { log: vi.fn() };
    const result = await removeRootAgentsIntegration(root, logger);

    expect(result.status).toBe("no_pointer_found");
    const content = await fs.readFile(rootAgentsPath, "utf8");
    expect(content).toBe("# Existing\n");
  });

  it("returns root_agents_missing when root AGENTS.md does not exist", async () => {
    const root = await createTempRoot("root-agents-clean-missing");
    cleanups.push(root);

    const logger = { log: vi.fn() };
    const result = await removeRootAgentsIntegration(root, logger);

    expect(result.status).toBe("root_agents_missing");
    expect(result.rootAgentsPath).toBe(path.join(root, "AGENTS.md"));
  });
});
