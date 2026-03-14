import * as vscode from "vscode";

export interface PostInstallGuidanceInput {
  targetRootPath: string;
  selectedProfile: string;
  logFilePath: string;
  managedStatePath: string;
  appliedCount: number;
  skippedCount: number;
  removedStaleCount: number;
}

export const POST_INSTALL_PANEL_VIEW_TYPE = "codexOnboarding.postInstall";
export const POST_INSTALL_PANEL_TITLE = "Codex Onboarding Installed";
export const COPY_STARTER_PROMPT_COMMAND = "codexOnboarding.copyStarterPrompt";
export const REPORT_ISSUE_COMMAND = "codexOnboarding.reportIssue";

const REPORT_ISSUE_URL = "https://github.com/mahdiahmadi1991/Codex-Onboarding-Workflow/issues/new";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function commandUri(command: string, args: unknown[] = []): string {
  if (args.length === 0) {
    return `command:${command}`;
  }

  return `command:${command}?${encodeURIComponent(JSON.stringify(args))}`;
}

function buildPromptPacks(onboardingRoot: string): {
  discover: string;
  implement: string;
  validate: string;
  starter: string;
} {
  const discover =
    `Read ${onboardingRoot}/core/AGENT-ONBOARDING.md and summarize active constraints for this project.`;
  const implement =
    "Before writing code, explain which onboarding boundaries apply and how your plan stays compliant.";
  const validate =
    "Review your output against onboarding constraints and list any conflicts with a safe override suggestion.";

  return {
    discover,
    implement,
    validate,
    starter: discover
  };
}

function buildWebviewHtml(input: PostInstallGuidanceInput): string {
  const onboardingRoot = `${input.targetRootPath}/.codex-onboarding`;
  const bootstrapFile = `${onboardingRoot}/core/AGENT-ONBOARDING.md`;

  const prompts = buildPromptPacks(onboardingRoot);

  const openManagedRootHref = commandUri("revealFileInOS", [vscode.Uri.file(onboardingRoot)]);
  const openLogHref = commandUri("revealFileInOS", [vscode.Uri.file(input.logFilePath)]);
  const runRepairHref = commandUri("codexOnboarding.repair");
  const runRemoveHref = commandUri("codexOnboarding.remove");
  const copyStarterPromptHref = commandUri(COPY_STARTER_PROMPT_COMMAND, [prompts.starter]);
  const reportIssueHref = commandUri(REPORT_ISSUE_COMMAND);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src data:; style-src 'unsafe-inline';"
    />
    <title>Codex Onboarding Installed</title>
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        padding: 20px;
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-font-family);
        line-height: 1.5;
      }
      .surface {
        max-width: 980px;
        margin: 0 auto;
      }
      .action-bar {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        padding: 12px;
        margin-bottom: 16px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 10px;
        background: var(--vscode-sideBar-background);
      }
      .action {
        text-decoration: none;
        border: 1px solid var(--vscode-button-border);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
      }
      .action:hover {
        background: var(--vscode-button-hoverBackground);
      }
      h1 {
        margin: 0 0 8px;
      }
      .subtitle {
        margin: 0 0 20px;
        color: var(--vscode-descriptionForeground);
      }
      .grid {
        display: grid;
        gap: 12px;
      }
      .card {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 10px;
        padding: 14px;
        background: var(--vscode-editorWidget-background);
      }
      .card h2 {
        margin: 0 0 10px;
        font-size: 16px;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 8px;
      }
      code, pre {
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
      }
      pre {
        margin: 8px 0 0;
        padding: 10px;
        overflow: auto;
        border-radius: 6px;
        border: 1px solid var(--vscode-panel-border);
        background: var(--vscode-textCodeBlock-background);
      }
      details {
        margin-top: 8px;
      }
      .muted {
        color: var(--vscode-descriptionForeground);
      }
      ul,
      ol {
        margin: 8px 0 0 18px;
      }
      .kpi {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px;
      }
      .kpi .item {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 8px;
      }
      .kpi .label {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
      }
      .kpi .value {
        font-size: 18px;
        font-weight: 600;
      }
      .actions-secondary {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .link {
        text-decoration: none;
        color: var(--vscode-textLink-foreground);
      }
      .link:hover {
        color: var(--vscode-textLink-activeForeground);
      }
    </style>
  </head>
  <body>
    <div class="surface">
      <div class="action-bar">
        <a class="action" href="${escapeHtml(openManagedRootHref)}">Open Managed Root</a>
        <a class="action" href="${escapeHtml(openLogHref)}">Open Operation Log</a>
        <a class="action" href="${escapeHtml(runRepairHref)}">Run Repair</a>
        <a class="action" href="${escapeHtml(runRemoveHref)}">Run Remove</a>
      </div>

      <h1>Codex Onboarding Installed</h1>
      <p class="subtitle">Install completed successfully. Review this page to activate onboarding behavior in your Codex workflow.</p>

      <div class="grid">
        <section class="card">
          <h2>Outcome Snapshot</h2>
          <div class="meta">
            <div><strong>Target Root:</strong> <code>${escapeHtml(input.targetRootPath)}</code></div>
            <div><strong>Selected Profile:</strong> <code>${escapeHtml(input.selectedProfile)}</code></div>
            <div><strong>Managed Root:</strong> <code>${escapeHtml(onboardingRoot)}</code></div>
            <div><strong>Bootstrap File:</strong> <code>${escapeHtml(bootstrapFile)}</code></div>
          </div>
        </section>

        <section class="card">
          <h2>Before/After Map</h2>
          <p class="muted">Before install, managed onboarding artifacts were not guaranteed in this workspace. After install, extension-owned artifacts are applied under <code>.codex-onboarding/</code> with tracked managed state.</p>
        </section>

        <section class="card">
          <h2>First 3 Steps</h2>
          <ol>
            <li>Ask Codex to read <code>.codex-onboarding/core/AGENT-ONBOARDING.md</code> first.</li>
            <li>Ask Codex to explain which constraints apply before code changes.</li>
            <li>If a conflict exists, request an override plan instead of editing managed core files.</li>
          </ol>
        </section>

        <section class="card">
          <h2>Prompt Packs</h2>
          <details open>
            <summary><strong>Discover</strong></summary>
            <pre>${escapeHtml(prompts.discover)}</pre>
          </details>
          <details>
            <summary><strong>Implement</strong></summary>
            <pre>${escapeHtml(prompts.implement)}</pre>
          </details>
          <details>
            <summary><strong>Validate</strong></summary>
            <pre>${escapeHtml(prompts.validate)}</pre>
          </details>
        </section>

        <section class="card">
          <h2>Safe Boundaries</h2>
          <ul>
            <li>Managed core files are extension-owned and should not be edited directly.</li>
            <li>Use <code>.codex-onboarding/overrides/</code> for project-specific exceptions.</li>
            <li>Issue escalation is optional and always user-controlled.</li>
          </ul>
        </section>

        <section class="card">
          <h2>Lifecycle Playbook</h2>
          <ul>
            <li><strong>Run Repair:</strong> use when managed state/files look inconsistent or missing.</li>
            <li><strong>Run Remove:</strong> use when you want to remove extension-owned onboarding artifacts safely.</li>
          </ul>
        </section>

        <section class="card">
          <h2>Change Report</h2>
          <div class="kpi">
            <div class="item"><div class="label">Applied Files</div><div class="value">${input.appliedCount}</div></div>
            <div class="item"><div class="label">Skipped Files</div><div class="value">${input.skippedCount}</div></div>
            <div class="item"><div class="label">Removed Stale Files</div><div class="value">${input.removedStaleCount}</div></div>
          </div>
          <details>
            <summary><strong>Details</strong></summary>
            <ul>
              <li><strong>Managed State:</strong> <code>${escapeHtml(input.managedStatePath)}</code></li>
              <li><strong>Operation Log:</strong> <code>${escapeHtml(input.logFilePath)}</code></li>
            </ul>
          </details>
        </section>

        <section class="card">
          <h2>Secondary Quick Actions</h2>
          <div class="actions-secondary">
            <a class="link" href="${escapeHtml(copyStarterPromptHref)}">Copy Starter Prompt</a>
            <a class="link" href="${escapeHtml(reportIssueHref)}">Report Onboarding Issue</a>
          </div>
          <p class="muted">Issue reports open a pre-filled issue page in the project repository.</p>
        </section>
      </div>
    </div>
  </body>
</html>`;
}

export async function openPostInstallGuidancePage(input: PostInstallGuidanceInput): Promise<boolean> {
  try {
    const panel = vscode.window.createWebviewPanel(
      POST_INSTALL_PANEL_VIEW_TYPE,
      POST_INSTALL_PANEL_TITLE,
      vscode.ViewColumn.One,
      {
        enableScripts: false,
        enableCommandUris: true,
        retainContextWhenHidden: false
      }
    );

    panel.webview.html = buildWebviewHtml(input);
    return true;
  } catch {
    await vscode.window.showWarningMessage(
      "Install completed, but the post-install guidance panel could not be opened."
    );
    return false;
  }
}

export const postInstallActions = {
  copyStarterPrompt: COPY_STARTER_PROMPT_COMMAND,
  reportIssue: REPORT_ISSUE_COMMAND,
  reportIssueUrl: REPORT_ISSUE_URL
};
