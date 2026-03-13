import * as fs from "node:fs/promises";
import * as path from "node:path";

import { QuestionnaireAssetLoad } from "../contracts/questionnaire";

function buildCandidateRoots(extensionPath: string): string[] {
  return [
    path.join(extensionPath, "onboarding-assets"),
    path.resolve(extensionPath, "..", "..", "codex-onboarding")
  ];
}

async function findAssetRoot(extensionPath: string): Promise<string> {
  const candidates = buildCandidateRoots(extensionPath);

  for (const root of candidates) {
    try {
      await fs.access(root);
      return root;
    } catch {
      // Try next candidate root.
    }
  }

  throw new Error("Unable to find onboarding asset root from extension path.");
}

export async function loadQuestionnaireAssets(
  extensionPath: string,
  family: string
): Promise<QuestionnaireAssetLoad> {
  const assetRoot = await findAssetRoot(extensionPath);

  const indexPath = path.join(assetRoot, "library", "questionnaires", "index.yaml");
  const flowPath = path.join(assetRoot, "library", "questionnaires", family, "install-flow.yaml");

  const [indexRaw, flowRaw] = await Promise.all([
    fs.readFile(indexPath, "utf8"),
    fs.readFile(flowPath, "utf8")
  ]);

  return {
    family,
    indexPath,
    flowPath,
    indexRaw,
    flowRaw
  };
}
