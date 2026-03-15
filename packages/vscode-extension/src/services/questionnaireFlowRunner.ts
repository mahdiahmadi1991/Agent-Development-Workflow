import * as vscode from "vscode";

import {
  ProfileSelectionAnswers,
  QuestionnaireFlow,
  QuestionnaireOption,
  QuestionnaireRuleCondition,
  QuestionnaireRuleExpression,
  QuestionnaireSelectNode
} from "../contracts/questionnaire";
import { LogLevel, LogValue } from "./outputLogger";

interface QuestionFlowLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

export interface DynamicQuestionRuntimeContext {
  env?: Record<string, string | number | boolean>;
  detect?: Record<string, string | number | boolean>;
}

interface QuickPickOptionItem extends vscode.QuickPickItem {
  option: QuestionnaireOption;
}

interface RuleFacts {
  answer: Record<string, string[]>;
  env: Record<string, string | number | boolean>;
  detect: Record<string, string | number | boolean>;
}

function toOptionDescription(option: QuestionnaireOption): string {
  if (option.description) {
    return option.description;
  }

  return `Option key: ${option.id}`;
}

function resolveRuleFactValue(fact: string, facts: RuleFacts): unknown {
  if (fact.startsWith("answer.")) {
    const key = fact.replace(/^answer\./, "");
    return facts.answer[key];
  }

  if (fact.startsWith("env.")) {
    const key = fact.replace(/^env\./, "");
    return facts.env[key];
  }

  if (fact.startsWith("detect.")) {
    const key = fact.replace(/^detect\./, "");
    return facts.detect[key];
  }

  return undefined;
}

function evaluateCondition(condition: QuestionnaireRuleCondition, facts: RuleFacts): boolean {
  const value = resolveRuleFactValue(condition.fact, facts);

  if (typeof condition.exists === "boolean") {
    const exists = Array.isArray(value) ? value.length > 0 : value !== undefined;
    if (exists !== condition.exists) {
      return false;
    }
  }

  if (condition.eq !== undefined) {
    if (Array.isArray(value)) {
      if (!value.includes(String(condition.eq))) {
        return false;
      }
    } else if (value !== condition.eq) {
      return false;
    }
  }

  if (condition.in !== undefined) {
    if (Array.isArray(value)) {
      const intersects = value.some((item) => condition.in?.includes(item));
      if (!intersects) {
        return false;
      }
    } else if (!condition.in.includes(value as string | number | boolean)) {
      return false;
    }
  }

  return true;
}

function evaluateRuleExpression(expression: QuestionnaireRuleExpression | undefined, facts: RuleFacts): boolean {
  if (!expression) {
    return true;
  }

  if (expression.all && expression.all.some((condition) => !evaluateCondition(condition, facts))) {
    return false;
  }

  if (expression.any && expression.any.every((condition) => !evaluateCondition(condition, facts))) {
    return false;
  }

  return true;
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

async function askSingleSelect(node: QuestionnaireSelectNode): Promise<QuestionnaireOption | undefined> {
  const options = node.options.map((option) => ({
    label: option.label,
    description: toOptionDescription(option),
    option
  }));

  const pick = await vscode.window.showQuickPick(options, {
    title: `Technology Selection Wizard: ${node.question}`,
    placeHolder: "Choose one option",
    ignoreFocusOut: true
  });

  return pick?.option;
}

async function askMultiSelect(
  node: QuestionnaireSelectNode,
  required: boolean
): Promise<QuestionnaireOption[] | undefined> {
  const options = node.options.map((option): QuickPickOptionItem => ({
    label: option.label,
    description: toOptionDescription(option),
    option
  }));

  const minSelect = node.min_select ?? (required ? 1 : 0);
  const maxSelect = node.max_select ?? Number.POSITIVE_INFINITY;

  while (true) {
    const picked = await vscode.window.showQuickPick(options, {
      title: `Technology Selection Wizard: ${node.question}`,
      placeHolder: minSelect > 0
        ? `Select ${minSelect}${Number.isFinite(maxSelect) ? `..${maxSelect}` : "+"} option(s)`
        : `Select up to ${Number.isFinite(maxSelect) ? maxSelect : "any number of"} option(s)`,
      canPickMany: true,
      ignoreFocusOut: true
    });

    if (!picked) {
      return undefined;
    }

    const selected = picked.map((item) => item.option);
    if (selected.length < minSelect || selected.length > maxSelect) {
      void vscode.window.showWarningMessage(
        `Selection for '${node.id}' must contain ${minSelect}..${Number.isFinite(maxSelect) ? maxSelect : "N"} option(s).`
      );
      continue;
    }

    return selected;
  }
}

export async function runDynamicQuestionFlow(
  flow: QuestionnaireFlow,
  logger: QuestionFlowLogger,
  operationId: string,
  runtimeContext?: DynamicQuestionRuntimeContext
): Promise<ProfileSelectionAnswers | undefined> {
  const answers: Record<string, string[]> = {};
  const selectedPaths: string[] = [];
  const capabilityTags: string[] = [];
  const profileHints: string[] = [];
  const topicTags: string[] = [];
  const familyKeys: string[] = [];
  const whySelected: ProfileSelectionAnswers["why_selected"] = [];
  const whySkipped: ProfileSelectionAnswers["why_skipped"] = [];

  const nodeMap = new Map(flow.nodes.map((node) => [node.id, node]));
  const askedNodes = new Set<string>();
  const visitStack = new Set<string>();

  const facts: RuleFacts = {
    answer: answers,
    env: runtimeContext?.env ?? {},
    detect: runtimeContext?.detect ?? {}
  };

  const appendEmits = (option: QuestionnaireOption): void => {
    if (!option.emits) {
      return;
    }

    capabilityTags.push(...(option.emits.capability_tags ?? []));
    profileHints.push(...(option.emits.profile_hints ?? []));
    topicTags.push(...(option.emits.topic_tags ?? []));
    familyKeys.push(...(option.emits.family_keys ?? []));
  };

  const visitNode = async (nodeId: string, parentPath: string[]): Promise<boolean> => {
    if (askedNodes.has(nodeId)) {
      return true;
    }

    if (visitStack.has(nodeId)) {
      throw new Error(`Question flow cycle detected at node '${nodeId}'.`);
    }

    const node = nodeMap.get(nodeId);
    if (!node) {
      throw new Error(`Question flow node '${nodeId}' was not found.`);
    }

    if (node.type === "end") {
      askedNodes.add(nodeId);
      return true;
    }

    visitStack.add(nodeId);

    const visible = evaluateRuleExpression(node.visible_when, facts);
    if (!visible) {
      whySkipped.push({
        kind: "node_hidden_by_rule",
        node_id: node.id,
        detail: "visible_when=false"
      });
      askedNodes.add(node.id);
      visitStack.delete(nodeId);
      return true;
    }

    const required = evaluateRuleExpression(node.required_when, facts);
    const options = node.options.filter((option) => {
      const optionVisible = evaluateRuleExpression(option.visible_when, facts);
      if (!optionVisible) {
        whySkipped.push({
          kind: "option_hidden_by_rule",
          node_id: node.id,
          option_id: option.id,
          detail: "visible_when=false"
        });
        return false;
      }

      const optionEnabled = evaluateRuleExpression(option.enabled_when, facts);
      if (!optionEnabled) {
        whySkipped.push({
          kind: "option_hidden_by_rule",
          node_id: node.id,
          option_id: option.id,
          detail: "enabled_when=false"
        });
        return false;
      }

      return true;
    });

    if (options.length === 0) {
      askedNodes.add(node.id);
      visitStack.delete(nodeId);
      if (required) {
        throw new Error(`No selectable options available for required node '${node.id}'.`);
      }

      answers[node.id] = [];
      return true;
    }

    const selectableNode: QuestionnaireSelectNode = {
      ...node,
      options
    };

    logger.log("debug", "dynamic_question_asked", {
      operation_id: operationId,
      node_id: node.id,
      selection_mode: node.selection_mode
    });

    const selectedOptions = node.selection_mode === "single"
      ? await askSingleSelect(selectableNode).then((single) => (single ? [single] : undefined))
      : await askMultiSelect(selectableNode, required);

    if (!selectedOptions) {
      logger.log("warning", "dynamic_question_cancelled", {
        operation_id: operationId,
        node_id: node.id
      });
      visitStack.delete(nodeId);
      return false;
    }

    answers[node.id] = selectedOptions.map((option) => option.id);
    askedNodes.add(node.id);

    logger.log("debug", "dynamic_question_answered", {
      operation_id: operationId,
      node_id: node.id,
      selected_option_ids: answers[node.id].join(",")
    });

    for (const option of selectedOptions) {
      const optionPath = [...parentPath, `${node.id}:${option.id}`];
      selectedPaths.push(optionPath.join(">"));
      whySelected.push({
        kind: "selected_option",
        node_id: node.id,
        option_id: option.id
      });
      appendEmits(option);

      if (option.next) {
        const continueFlow = await visitNode(option.next, optionPath);
        if (!continueFlow) {
          visitStack.delete(nodeId);
          return false;
        }
      }
    }

    visitStack.delete(nodeId);
    return true;
  };

  const complete = await visitNode(flow.entrypoint, []);
  if (!complete) {
    return undefined;
  }

  return {
    answers,
    selected_paths: selectedPaths,
    capability_tags: dedupe(capabilityTags),
    profile_hints: dedupe(profileHints),
    topic_tags: dedupe(topicTags),
    family_keys: dedupe(familyKeys),
    why_selected: whySelected,
    why_skipped: whySkipped
  };
}

