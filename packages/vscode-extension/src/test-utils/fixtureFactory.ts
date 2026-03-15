import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export interface FixturePaths {
  tempRoot: string;
  extensionPath: string;
  assetRoot: string;
  targetRoot: string;
}

function bootstrapContent(): string {
  return [
    "<!--",
    "artifact_id: core-agent-onboarding",
    "managed: true",
    "schema_version: 1",
    "bundle_id: TBD",
    "bundle_version: TBD",
    "extension_version: TBD",
    "-->",
    "",
    "# Bootstrap"
  ].join("\n");
}

function issueReportingContent(): string {
  return [
    "<!--",
    "artifact_id: core-issue-reporting-guidance",
    "managed: true",
    "schema_version: 1",
    "bundle_id: TBD",
    "bundle_version: TBD",
    "extension_version: TBD",
    "-->",
    "",
    "# Issue Reporting"
  ].join("\n");
}

function onboardingIndexContent(): string {
  return [
    "<!--",
    "artifact_id: core-onboarding-index",
    "managed: true",
    "schema_version: 1",
    "bundle_id: TBD",
    "bundle_version: TBD",
    "extension_version: TBD",
    "-->",
    "",
    "# Onboarding Index"
  ].join("\n");
}

function topicContent(fileId: string): string {
  return [
    "<!--",
    `artifact_id: ${fileId}`,
    "managed: true",
    "schema_version: 1",
    "bundle_id: TBD",
    "bundle_version: TBD",
    "extension_version: TBD",
    "-->",
    "",
    `# ${fileId}`
  ].join("\n");
}

export async function createFixturePaths(prefix: string): Promise<FixturePaths> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  const extensionPath = path.join(tempRoot, "extension");
  const assetRoot = path.join(extensionPath, "onboarding-assets");
  const targetRoot = path.join(tempRoot, "consumer");

  await fs.mkdir(assetRoot, { recursive: true });
  await fs.mkdir(targetRoot, { recursive: true });

  return {
    tempRoot,
    extensionPath,
    assetRoot,
    targetRoot
  };
}

export async function writeBootstrap(assetRoot: string): Promise<void> {
  const coreRoot = path.join(assetRoot, "core");
  await fs.mkdir(coreRoot, { recursive: true });
  await fs.writeFile(path.join(coreRoot, "AGENTS.md"), bootstrapContent(), "utf8");
  await fs.writeFile(path.join(coreRoot, "INDEX.md"), onboardingIndexContent(), "utf8");
  await fs.writeFile(path.join(coreRoot, "ISSUE-REPORTING.md"), issueReportingContent(), "utf8");
}

export async function writeTopic(assetRoot: string, topicRelativePath: string, fileId: string): Promise<void> {
  const normalized = topicRelativePath.replace(/^topics\//, "");
  const filePath = path.join(assetRoot, "library", "topics", normalized);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, topicContent(fileId), "utf8");
}

export async function writeAssetFile(assetRoot: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(assetRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

export async function cleanupFixture(tempRoot: string): Promise<void> {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
