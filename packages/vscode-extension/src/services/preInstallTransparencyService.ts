import * as vscode from "vscode";

import { LogLevel, LogValue } from "./outputLogger";

interface TransparencyLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

interface PreInstallTransparencyInput {
  command: "install";
  targetRootPath: string;
  repositoryUrl?: string;
  selectedTopics: Array<{
    fileId: string;
    category: string;
    reasons: string[];
  }>;
}

interface PreInstallTransparencyResult {
  acknowledged: boolean;
  openedSummary: boolean;
}

function toConsumerSummaryUrl(repositoryUrl?: string): string | undefined {
  if (!repositoryUrl) {
    return undefined;
  }

  const normalized = repositoryUrl
    .replace(/^git\+/, "")
    .replace(/^git@github.com:/, "https://github.com/")
    .replace(/\.git$/, "");

  if (!normalized.startsWith("https://github.com/")) {
    return undefined;
  }

  return `${normalized}/blob/develop/docs/consumer/README.md`;
}

function summarizeSelection(input: PreInstallTransparencyInput): {
  shortSummary: string;
  markdownDetails: string;
} {
  const total = input.selectedTopics.length;
  const baselineCount = input.selectedTopics.filter((topic) =>
    topic.category.startsWith("00-") || topic.reasons.some((reason) => reason.includes("profile_baseline"))
  ).length;
  const crossCuttingCount = input.selectedTopics.filter((topic) =>
    topic.category.includes("cross-cutting")
  ).length;
  const targetSpecificCount = Math.max(total - baselineCount - crossCuttingCount, 0);

  const reasonCounts = new Map<string, number>();
  for (const topic of input.selectedTopics) {
    for (const reason of topic.reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }

  const reasonSummary = Array.from(reasonCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([reason, count]) => `${reason}(${count})`)
    .join(", ");

  const detailRows = input.selectedTopics
    .slice()
    .sort((left, right) => left.fileId.localeCompare(right.fileId))
    .map((topic) => `- \`${topic.fileId}\` (${topic.category}) -> ${topic.reasons.join(", ") || "none"}`)
    .join("\n");

  const shortSummary = [
    `Topics: ${total}`,
    `baseline: ${baselineCount}`,
    `cross-cutting: ${crossCuttingCount}`,
    `target-specific: ${targetSpecificCount}`
  ].join(" | ");

  const markdownDetails = [
    "# Selection Explainability (Pre-Install)",
    "",
    `- Target root: \`${input.targetRootPath}\``,
    `- Selected topics: **${total}**`,
    `- Baseline/core: **${baselineCount}**`,
    `- Cross-cutting: **${crossCuttingCount}**`,
    `- Target-specific: **${targetSpecificCount}**`,
    "",
    "## Top Reason Tags",
    reasonSummary ? `- ${reasonSummary}` : "- none",
    "",
    "## Selected Topic List",
    detailRows || "_No topic-level artifacts selected in this run._"
  ].join("\n");

  return {
    shortSummary,
    markdownDetails
  };
}

export async function requirePreInstallTransparencyAcknowledgement(
  input: PreInstallTransparencyInput,
  logger: TransparencyLogger
): Promise<PreInstallTransparencyResult> {
  const summaryUrl = toConsumerSummaryUrl(input.repositoryUrl);
  const explainability = summarizeSelection(input);

  logger.log("debug", "operational_question_asked", {
    question_id: "pre_install_transparency_ack",
    command: input.command,
    target_root: input.targetRootPath,
    selected_topic_count: input.selectedTopics.length
  });

  const decision = await vscode.window.showQuickPick(
    [
      {
        label: "Continue Install (Acknowledged)",
        description:
          "I reviewed managed-file behavior, non-destructive policy, lifecycle commands, and update/drift boundaries.",
        value: "continue"
      },
      {
        label: "Open Selection Explainability (Cancel for now)",
        description: "Open detailed topic-selection reasons before install.",
        value: "open_explainability"
      },
      {
        label: "Open Consumer Summary (Cancel for now)",
        description:
          "Open the consumer-facing behavior summary and rerun install after review.",
        value: "open_summary"
      },
      {
        label: "Cancel Install",
        description: "Stop install without changing files.",
        value: "cancel"
      }
    ],
    {
      title: "Pre-Install Transparency Check",
      placeHolder: `Review behavior impact before apply. ${explainability.shortSummary}`,
      ignoreFocusOut: true
    }
  );

  if (!decision || decision.value === "cancel") {
    logger.log("warning", "operation_blocked", {
      reason: "pre_install_transparency_declined"
    });
    return {
      acknowledged: false,
      openedSummary: false
    };
  }

  if (decision.value === "open_explainability") {
    const document = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: explainability.markdownDetails
    });
    await vscode.window.showTextDocument(document, { preview: false });

    logger.log("warning", "operation_blocked", {
      reason: "pre_install_transparency_opened_explainability"
    });

    return {
      acknowledged: false,
      openedSummary: false
    };
  }

  if (decision.value === "open_summary") {
    if (summaryUrl) {
      await vscode.env.openExternal(vscode.Uri.parse(summaryUrl));
    } else {
      void vscode.window.showInformationMessage(
        "Consumer summary URL is not configured in extension metadata."
      );
    }

    logger.log("warning", "operation_blocked", {
      reason: "pre_install_transparency_opened_summary"
    });

    return {
      acknowledged: false,
      openedSummary: true
    };
  }

  return {
    acknowledged: true,
    openedSummary: false
  };
}
