import * as vscode from "vscode";

interface PostInstallGuidanceInput {
  targetRootPath: string;
  selectedProfile: string;
  logFilePath: string;
}

function buildGuidanceMarkdown(input: PostInstallGuidanceInput): string {
  const onboardingRoot = `${input.targetRootPath}/codex-onboarding`;

  return [
    "# Codex Onboarding Installed",
    "",
    "The onboarding bootstrap was applied successfully.",
    "",
    "## What Was Applied",
    `- Target profile: \`${input.selectedProfile}\``,
    `- Managed root: \`${onboardingRoot}\``,
    `- Bootstrap file: \`${onboardingRoot}/core/AGENT-ONBOARDING.md\``,
    `- Operation log: \`${input.logFilePath}\``,
    "",
    "## Quick Start Prompts For Codex",
    "- `Read codex-onboarding/core/AGENT-ONBOARDING.md and summarize the active policy boundaries.`",
    "- `Before coding, explain which onboarding constraints apply to this task.`",
    "- `If there is any conflict with project needs, propose an override plan instead of editing managed core files.`",
    "",
    "## Notes",
    "- Managed core files are extension-owned.",
    "- Use `codex-onboarding/overrides/` for project-specific exceptions.",
    "- Existing consumer files are not overwritten by default."
  ].join("\n");
}

export async function openPostInstallGuidancePage(input: PostInstallGuidanceInput): Promise<void> {
  const content = buildGuidanceMarkdown(input);
  const doc = await vscode.workspace.openTextDocument({
    language: "markdown",
    content
  });

  await vscode.window.showTextDocument(doc, {
    preview: false,
    preserveFocus: false
  });
}
