import * as vscode from "vscode";

import { ProfileSelectionAnswers, QuestionnaireFlow } from "../contracts/questionnaire";
import { LogLevel, LogValue } from "./outputLogger";

interface QuestionFlowLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
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
        option
      })),
      {
        title: `Profile Selection Questions: ${node.question}`,
        placeHolder: "Choose one option"
      }
    );

    if (!pick) {
      return undefined;
    }

    answers[node.id] = pick.option.id;
    currentNodeId = pick.option.next;
  }
}
