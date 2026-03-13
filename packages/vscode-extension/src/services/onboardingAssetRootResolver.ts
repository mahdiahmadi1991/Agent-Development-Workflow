import * as fs from "node:fs/promises";
import * as path from "node:path";

function buildCandidateRoots(extensionPath: string): string[] {
  return [
    path.join(extensionPath, "onboarding-assets"),
    path.resolve(extensionPath, "..", "..", "codex-onboarding")
  ];
}

export async function resolveOnboardingAssetRoot(extensionPath: string): Promise<string> {
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
