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

function buildCandidateRoots(extensionPath: string): string[] {
  return [
    path.join(extensionPath, "onboarding-assets"),
    path.resolve(extensionPath, "..", "..", "codex-onboarding")
  ];
}

async function findAssetRoot(extensionPath: string): Promise<string> {
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

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parseOption(raw: unknown): QuestionnaireOption {
  const obj = raw as Record<string, unknown>;
  if (!obj || !isString(obj.id) || !isString(obj.label) || !isString(obj.next)) {
    throw new Error("Invalid questionnaire option shape.");
  }

  return {
    id: obj.id,
    label: obj.label,
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

export async function loadQuestionnaireAssets(
  extensionPath: string,
  family: string
): Promise<QuestionnaireAssetLoad> {
  const assetRoot = await findAssetRoot(extensionPath);

  const indexPath = path.join(assetRoot, "library", "questionnaires", "index.yaml");
  const flowPath = path.join(assetRoot, "library", "questionnaires", family, "install-flow.yaml");

  const [indexRaw, flowRaw] = await Promise.all([
    fs.readFile(indexPath, "utf8"),
    fs.readFile(flowPath, "utf8")
  ]);

  if (!indexRaw.includes(family)) {
    throw new Error(`Questionnaire family '${family}' is not listed in questionnaires index.`);
  }

  return {
    family,
    indexPath,
    flowPath,
    flow: parseFlow(flowRaw)
  };
}
