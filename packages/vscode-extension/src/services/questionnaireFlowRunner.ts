import * as vscode from "vscode";

import { ProfileSelectionAnswers, QuestionnaireFlow, QuestionnaireOption } from "../contracts/questionnaire";
import { LogLevel, LogValue } from "./outputLogger";

interface QuestionFlowLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

function toOptionDescription(option: QuestionnaireOption): string {
  if (option.description) {
    return option.description;
  }

  return `Option key: ${option.id}`;
}

export async function runDynamicQuestionFlow(
  flow: QuestionnaireFlow,
  logger: QuestionFlowLogger,
  operationId: string
): Promise<ProfileSelectionAnswers | undefined> {
  const answers: Record<string, string> = {};
  let currentNodeId = flow.entrypoint;

  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));

  while (true) {
    const node = nodeMap.get(currentNodeId);

    if (!node) {
      throw new Error(`Question flow node '${currentNodeId}' was not found.`);
    }

    if (node.type === "end") {
      return { answers };
    }

    logger.log("debug", "dynamic_question_asked", {
      operation_id: operationId,
      node_id: node.id
    });

    const pick = await vscode.window.showQuickPick(
      node.options.map((option) => ({
        label: option.label,
        description: toOptionDescription(option),
        option
      })),
      {
        title: `Project Profile: ${node.question}`,
        placeHolder: "Choose the best match for this workspace",
        ignoreFocusOut: true
      }
    );

    if (!pick) {
      logger.log("warning", "dynamic_question_cancelled", {
        operation_id: operationId,
        node_id: node.id
      });
      return undefined;
    }

    answers[node.id] = pick.option.id;
    currentNodeId = pick.option.next;
  }
}
