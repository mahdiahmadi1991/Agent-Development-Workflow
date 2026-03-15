import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parse } from "yaml";

import {
  QuestionnaireAssetLoad,
  QuestionnaireFlow,
  QuestionnaireNode,
  QuestionnaireOption,
  QuestionnaireSelectNode
} from "../contracts/questionnaire";
import { resolveOnboardingAssetRoot } from "./onboardingAssetRootResolver";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parseOption(raw: unknown): QuestionnaireOption {
  const obj = raw as Record<string, unknown>;
  if (!obj || !isString(obj.id) || !isString(obj.label) || !isString(obj.next)) {
    throw new Error("Invalid questionnaire option shape.");
  }

  if (obj.description !== undefined && !isString(obj.description)) {
    throw new Error(`Invalid questionnaire option description for option '${obj.id}'.`);
  }

  return {
    id: obj.id,
    label: obj.label,
    description: isString(obj.description) ? obj.description : undefined,
    next: obj.next
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

    const options = obj.options.map(parseOption);
    const node: QuestionnaireSelectNode = {
      id: obj.id,
      type: "select",
      question: obj.question,
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
