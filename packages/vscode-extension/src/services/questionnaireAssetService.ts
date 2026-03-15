import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parse } from "yaml";

import {
  QuestionnaireAssetLoad,
  QuestionnaireFlow,
  QuestionnaireNode,
  QuestionnaireOption,
  QuestionnaireOptionEmits,
  QuestionnaireRuleCondition,
  QuestionnaireRuleExpression,
  QuestionnaireSelectNode
} from "../contracts/questionnaire";
import { resolveOnboardingAssetRoot } from "./onboardingAssetRootResolver";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parseOption(raw: unknown): QuestionnaireOption {
  const obj = raw as Record<string, unknown>;
  if (!obj || !isString(obj.id) || !isString(obj.label)) {
    throw new Error("Invalid questionnaire option shape.");
  }

  if (obj.description !== undefined && !isString(obj.description)) {
    throw new Error(`Invalid questionnaire option description for option '${obj.id}'.`);
  }

  if (obj.next !== undefined && !isString(obj.next)) {
    throw new Error(`Invalid questionnaire option next target for option '${obj.id}'.`);
  }

  const emits = parseOptionEmits(obj.emits, obj.id);
  const visibleWhen = parseRuleExpression(obj.visible_when, `option '${obj.id}' visible_when`);
  const enabledWhen = parseRuleExpression(obj.enabled_when, `option '${obj.id}' enabled_when`);

  return {
    id: obj.id,
    label: obj.label,
    description: isString(obj.description) ? obj.description : undefined,
    next: isString(obj.next) ? obj.next : undefined,
    emits,
    visible_when: visibleWhen,
    enabled_when: enabledWhen
  };
}

function parseNode(raw: unknown): QuestionnaireNode {
  const obj = raw as Record<string, unknown>;
  if (!obj || !isString(obj.id) || !isString(obj.type)) {
    throw new Error("Invalid questionnaire node shape.");
  }

  if (obj.type === "end") {
    return {
      id: obj.id,
      type: "end"
    };
  }

  if (obj.type === "select") {
    if (!isString(obj.question) || !Array.isArray(obj.options)) {
      throw new Error(`Invalid select node shape for node '${obj.id}'.`);
    }

    if (obj.selection_mode !== "single" && obj.selection_mode !== "multi") {
      throw new Error(`Invalid selection_mode for node '${obj.id}'.`);
    }

    if (obj.min_select !== undefined && (typeof obj.min_select !== "number" || !Number.isInteger(obj.min_select))) {
      throw new Error(`Invalid min_select for node '${obj.id}'.`);
    }

    if (obj.max_select !== undefined && (typeof obj.max_select !== "number" || !Number.isInteger(obj.max_select))) {
      throw new Error(`Invalid max_select for node '${obj.id}'.`);
    }

    if (
      typeof obj.min_select === "number" &&
      typeof obj.max_select === "number" &&
      obj.min_select > obj.max_select
    ) {
      throw new Error(`Invalid select constraints for node '${obj.id}': min_select > max_select.`);
    }

    const options = obj.options.map(parseOption);
    const node: QuestionnaireSelectNode = {
      id: obj.id,
      type: "select",
      question: obj.question,
      selection_mode: obj.selection_mode,
      min_select: typeof obj.min_select === "number" ? obj.min_select : undefined,
      max_select: typeof obj.max_select === "number" ? obj.max_select : undefined,
      visible_when: parseRuleExpression(obj.visible_when, `node '${obj.id}' visible_when`),
      required_when: parseRuleExpression(obj.required_when, `node '${obj.id}' required_when`),
      options
    };

    return node;
  }

  throw new Error(`Unsupported questionnaire node type '${obj.type}'.`);
}

function parseFlow(rawYaml: string): QuestionnaireFlow {
  const parsed = parse(rawYaml) as Record<string, unknown>;

  if (
    !parsed ||
    typeof parsed.version !== "number" ||
    !isString(parsed.family) ||
    !isString(parsed.entrypoint) ||
    !Array.isArray(parsed.nodes)
  ) {
    throw new Error("Invalid questionnaire flow document.");
  }

  const nodes = parsed.nodes.map(parseNode);

  if (!nodes.some((n) => n.id === parsed.entrypoint)) {
    throw new Error("Questionnaire entrypoint node is missing.");
  }

  const nodeIdSet = new Set<string>();
  for (const node of nodes) {
    if (nodeIdSet.has(node.id)) {
      throw new Error(`Duplicate questionnaire node id '${node.id}'.`);
    }

    nodeIdSet.add(node.id);
  }

  for (const node of nodes) {
    if (node.type !== "select") {
      continue;
    }

    for (const option of node.options) {
      if (!option.next) {
        continue;
      }

      if (!nodeIdSet.has(option.next)) {
        throw new Error(
          `Questionnaire option '${option.id}' in node '${node.id}' points to missing node '${option.next}'.`
        );
      }
    }
  }

  return {
    version: parsed.version,
    family: parsed.family,
    entrypoint: parsed.entrypoint,
    nodes
  };
}

interface QuestionnaireCatalogRawFamily {
  install_flow: string;
}

interface QuestionnaireCatalogRaw {
  version: number;
  families: Record<string, QuestionnaireCatalogRawFamily>;
}

export interface QuestionnaireCatalogEntry {
  family: string;
  installFlowRelativePath: string;
}

export interface QuestionnaireCatalogLoad {
  version: number;
  indexPath: string;
  families: QuestionnaireCatalogEntry[];
}

function toAssetRelativePath(rawPath: string): string {
  const withoutDotPrefix = rawPath.replace(/^\.\//, "");
  const withoutRootPrefix = withoutDotPrefix.replace(/^\.codex-onboarding\//, "");
  const normalized = withoutRootPrefix.split("\\").join("/");

  if (normalized.length === 0) {
    throw new Error("Questionnaire install_flow path is empty.");
  }

  const resolved = normalized.startsWith("/") ? normalized.slice(1) : normalized;
  if (resolved.startsWith("../") || resolved.includes("/../")) {
    throw new Error("Questionnaire install_flow path must stay inside onboarding assets.");
  }

  return resolved;
}

function parseCatalog(rawYaml: string): QuestionnaireCatalogRaw {
  const parsed = parse(rawYaml) as QuestionnaireCatalogRaw;

  if (
    !parsed ||
    typeof parsed.version !== "number" ||
    !parsed.families ||
    typeof parsed.families !== "object"
  ) {
    throw new Error("Invalid questionnaires index document.");
  }

  return parsed;
}

function ensureStringArray(value: unknown, fieldName: string, optionId: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => !isString(item))) {
    throw new Error(`Invalid ${fieldName} in questionnaire option '${optionId}'.`);
  }

  return value;
}

function validateRuleFactPath(fact: string, location: string): void {
  const allowedPrefixes = ["answer.", "env.", "detect."];
  if (!allowedPrefixes.some((prefix) => fact.startsWith(prefix))) {
    throw new Error(`Unsupported fact '${fact}' in ${location}. Allowed prefixes: answer., env., detect.`);
  }
}

function parseRuleCondition(raw: unknown, location: string): QuestionnaireRuleCondition {
  const obj = raw as Record<string, unknown>;
  if (!obj || !isString(obj.fact)) {
    throw new Error(`Invalid rule condition in ${location}.`);
  }

  validateRuleFactPath(obj.fact, location);

  if (obj.in !== undefined && (!Array.isArray(obj.in) || obj.in.length === 0)) {
    throw new Error(`Invalid 'in' rule array in ${location}.`);
  }

  if (obj.exists !== undefined && typeof obj.exists !== "boolean") {
    throw new Error(`Invalid 'exists' rule value in ${location}.`);
  }

  return {
    fact: obj.fact,
    eq: obj.eq as string | number | boolean | undefined,
    in: obj.in as Array<string | number | boolean> | undefined,
    exists: obj.exists as boolean | undefined
  };
}

function parseRuleExpression(raw: unknown, location: string): QuestionnaireRuleExpression | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const obj = raw as Record<string, unknown>;
  if (!obj || typeof obj !== "object") {
    throw new Error(`Invalid rule expression in ${location}.`);
  }

  const allRaw = obj.all;
  const anyRaw = obj.any;

  if (allRaw === undefined && anyRaw === undefined) {
    throw new Error(`Rule expression in ${location} must define 'all' or 'any'.`);
  }

  const result: QuestionnaireRuleExpression = {};

  if (allRaw !== undefined) {
    if (!Array.isArray(allRaw) || allRaw.length === 0) {
      throw new Error(`Rule 'all' in ${location} must be a non-empty array.`);
    }

    result.all = allRaw.map((item) => parseRuleCondition(item, location));
  }

  if (anyRaw !== undefined) {
    if (!Array.isArray(anyRaw) || anyRaw.length === 0) {
      throw new Error(`Rule 'any' in ${location} must be a non-empty array.`);
    }

    result.any = anyRaw.map((item) => parseRuleCondition(item, location));
  }

  return result;
}

function parseOptionEmits(raw: unknown, optionId: string): QuestionnaireOptionEmits | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const obj = raw as Record<string, unknown>;
  if (!obj || typeof obj !== "object") {
    throw new Error(`Invalid emits block in questionnaire option '${optionId}'.`);
  }

  const emits: QuestionnaireOptionEmits = {
    capability_tags: ensureStringArray(obj.capability_tags, "capability_tags", optionId),
    profile_hints: ensureStringArray(obj.profile_hints, "profile_hints", optionId),
    topic_tags: ensureStringArray(obj.topic_tags, "topic_tags", optionId),
    family_keys: ensureStringArray(obj.family_keys, "family_keys", optionId)
  };

  const hasAnyValue =
    (emits.capability_tags?.length ?? 0) > 0 ||
    (emits.profile_hints?.length ?? 0) > 0 ||
    (emits.topic_tags?.length ?? 0) > 0 ||
    (emits.family_keys?.length ?? 0) > 0;

  return hasAnyValue ? emits : undefined;
}

export async function loadQuestionnaireCatalog(
  extensionPath: string
): Promise<QuestionnaireCatalogLoad> {
  const assetRoot = await resolveOnboardingAssetRoot(extensionPath);
  const indexPath = path.join(assetRoot, "library", "questionnaires", "index.yaml");
  const indexRaw = await fs.readFile(indexPath, "utf8");
  const parsed = parseCatalog(indexRaw);

  const families = Object.entries(parsed.families)
    .map(([family, value]) => {
      if (!value || !isString(value.install_flow)) {
        throw new Error(`Invalid questionnaires index entry for family '${family}'.`);
      }

      return {
        family,
        installFlowRelativePath: toAssetRelativePath(value.install_flow)
      };
    })
    .sort((left, right) => left.family.localeCompare(right.family));

  if (families.length === 0) {
    throw new Error("Questionnaires index contains no families.");
  }

  return {
    version: parsed.version,
    indexPath,
    families
  };
}

export async function loadQuestionnaireAssets(
  extensionPath: string,
  family: string
): Promise<QuestionnaireAssetLoad> {
  const assetRoot = await resolveOnboardingAssetRoot(extensionPath);
  const catalog = await loadQuestionnaireCatalog(extensionPath);
  const familyEntry = catalog.families.find((item) => item.family === family);
  if (!familyEntry) {
    throw new Error(`Questionnaire family '${family}' is not listed in questionnaires index.`);
  }
  const flowPath = path.join(assetRoot, familyEntry.installFlowRelativePath);
  const flowRaw = await fs.readFile(flowPath, "utf8");

  return {
    family,
    indexPath: catalog.indexPath,
    flowPath,
    flow: parseFlow(flowRaw)
  };
}
