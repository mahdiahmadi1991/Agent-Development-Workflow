import * as fs from "node:fs/promises";
import * as path from "node:path";

interface WorkspaceSignals {
  signals: string[];
  asFacts: Record<string, boolean>;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

async function listDirectory(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

export async function detectWorkspaceSignals(rootPath: string): Promise<WorkspaceSignals> {
  const signals: string[] = [];

  const rootEntries = await listDirectory(rootPath);
  const hasSolutionFile = rootEntries.some((entry) => entry.endsWith(".sln"));
  const hasCsprojInRoot = rootEntries.some((entry) => entry.endsWith(".csproj"));

  if (hasSolutionFile || hasCsprojInRoot) {
    signals.push("dotnet");
  }

  if (rootEntries.includes("package.json")) {
    signals.push("nodejs");

    try {
      const packageJsonPath = path.join(rootPath, "package.json");
      const packageRaw = await fs.readFile(packageJsonPath, "utf8");
      const parsed = JSON.parse(packageRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const dependencyKeys = Object.keys(parsed.dependencies ?? {});
      const devDependencyKeys = Object.keys(parsed.devDependencies ?? {});
      const allDeps = new Set([...dependencyKeys, ...devDependencyKeys]);

      if (allDeps.has("react")) {
        signals.push("react");
      }

      if (allDeps.has("vue")) {
        signals.push("vue");
      }

      if (allDeps.has("@angular/core")) {
        signals.push("angular");
      }
    } catch {
      // Best-effort detection only.
    }
  }

  const normalized = dedupe(signals);
  const asFacts: Record<string, boolean> = {};
  for (const signal of normalized) {
    asFacts[signal] = true;
  }

  return {
    signals: normalized,
    asFacts
  };
}

