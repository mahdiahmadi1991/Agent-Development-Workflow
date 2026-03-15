import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parse } from "yaml";

import {
  ResolverRules,
  SelectionPlan,
  SelectedTopic,
  TopicIndexEntry,
  TopicsIndexDocument
} from "../contracts/selection";
import { LogLevel, LogValue } from "./outputLogger";
import { resolveOnboardingAssetRoot } from "./onboardingAssetRootResolver";

interface SelectionLogger {
  log(level: LogLevel, message: string, fields?: Record<string, LogValue>): void;
}

interface ResolveSelectionInput {
  extensionPath: string;
  family: string;
  profileId: string;
  baselineTopicIds: string[];
  defaultCapabilities: string[];
  questionAnswers: Record<string, string[]>;
  wizardCapabilityTags?: string[];
  wizardTopicTags?: string[];
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error("Expected object value.");
  }

  return value as Record<string, unknown>;
}

function parseTopicEntry(raw: unknown): TopicIndexEntry {
  const obj = asRecord(raw);

  if (
    !isString(obj.file_id) ||
    !isString(obj.path) ||
    !isString(obj.category) ||
    !isString(obj.severity) ||
    typeof obj.required !== "boolean" ||
    !isStringArray(obj.tags) ||
    typeof obj.applicability !== "object" ||
    !isStringArray(obj.requires) ||
    !isStringArray(obj.conflicts_with)
  ) {
    throw new Error("Invalid topic index entry shape.");
  }

  return {
    file_id: obj.file_id,
    path: obj.path,
    category: obj.category,
    severity: obj.severity,
    required: obj.required,
    tags: obj.tags,
    applicability: obj.applicability as Record<string, unknown>,
    requires: obj.requires,
    conflicts_with: obj.conflicts_with
  };
}

function parseTopicsIndex(rawYaml: string): TopicsIndexDocument {
  const parsed = parse(rawYaml) as Record<string, unknown>;

  if (!parsed || typeof parsed.version !== "number" || !Array.isArray(parsed.topics)) {
    throw new Error("Invalid topics index document.");
  }

  const topics = parsed.topics.map(parseTopicEntry);
  return {
    version: parsed.version,
    topics
  };
}

function parseResolverRules(rawYaml: string): ResolverRules {
  const parsed = parse(rawYaml) as Record<string, unknown>;
  if (!parsed || !parsed.resolver) {
    throw new Error("Invalid selector rules document.");
  }

  const resolver = asRecord(parsed.resolver);
  const deterministicSort = resolver.deterministic_sort;
  const conflictResolution = asRecord(resolver.conflict_resolution);
  const dependencyPolicy = asRecord(resolver.dependency_policy);

  if (
    !isStringArray(deterministicSort) ||
    !isString(conflictResolution.strategy) ||
    !isString(conflictResolution.optional_topic_policy) ||
    !isString(dependencyPolicy.missing_dependency)
  ) {
    throw new Error("Invalid selector resolver rules shape.");
  }

  return {
    deterministic_sort: deterministicSort,
    conflict_resolution: {
      strategy: conflictResolution.strategy,
      optional_topic_policy: conflictResolution.optional_topic_policy
    },
    dependency_policy: {
      missing_dependency: dependencyPolicy.missing_dependency
    }
  };
}

function buildCapabilityTags(
  defaultCapabilities: string[],
  questionAnswers: Record<string, string[]>,
  wizardCapabilityTags: string[],
  wizardTopicTags: string[]
): string[] {
  const dynamic = Object.entries(questionAnswers).flatMap(([nodeId, answers]) =>
    answers.map((answer) => `answer.${nodeId}.${answer}`)
  );
  return Array.from(new Set([...defaultCapabilities, ...wizardCapabilityTags, ...wizardTopicTags, ...dynamic]));
}

function matchesApplicability(topic: TopicIndexEntry, family: string): boolean {
  const families = topic.applicability["families"];

  if (!families) {
    return true;
  }

  return isStringArray(families) ? families.includes(family) : true;
}

function matchesCapability(topic: TopicIndexEntry, capabilities: string[]): boolean {
  if (topic.tags.length === 0) {
    return true;
  }

  return topic.tags.some((tag) => capabilities.includes(tag));
}

function buildSelectedTopic(topic: TopicIndexEntry, reasons: string[]): SelectedTopic {
  return {
    file_id: topic.file_id,
    path: topic.path,
    category: topic.category,
    required: topic.required,
    reasons
  };
}

function sortSelectedTopics(items: SelectedTopic[], rules: ResolverRules): SelectedTopic[] {
  const order = rules.deterministic_sort;
  const hasRequired = order.includes("required");
  const hasCategory = order.includes("category");
  const hasFileId = order.includes("file_id");

  return [...items].sort((a, b) => {
    if (hasRequired && a.required !== b.required) {
      return a.required ? -1 : 1;
    }

    if (hasCategory) {
      const categoryCompare = a.category.localeCompare(b.category);
      if (categoryCompare !== 0) {
        return categoryCompare;
      }
    }

    if (hasFileId) {
      return a.file_id.localeCompare(b.file_id);
    }

    return 0;
  });
}

export async function resolveSelectionPlan(
  input: ResolveSelectionInput,
  logger: SelectionLogger
): Promise<SelectionPlan> {
  const assetRoot = await resolveOnboardingAssetRoot(input.extensionPath);
  const topicsIndexPath = path.join(assetRoot, "library", "indexes", "topics.index.yaml");
  const rulesPath = path.join(assetRoot, "library", "rules", "selector-rules.yaml");

  const [topicsRaw, rulesRaw] = await Promise.all([
    fs.readFile(topicsIndexPath, "utf8"),
    fs.readFile(rulesPath, "utf8")
  ]);

  const topicsIndex = parseTopicsIndex(topicsRaw);
  const rules = parseResolverRules(rulesRaw);

  const capabilities = buildCapabilityTags(
    input.defaultCapabilities,
    input.questionAnswers,
    input.wizardCapabilityTags ?? [],
    input.wizardTopicTags ?? []
  );
  const topicMap = new Map<string, TopicIndexEntry>(topicsIndex.topics.map((topic) => [topic.file_id, topic]));
  const selectedMap = new Map<string, SelectedTopic>();

  for (const baselineId of input.baselineTopicIds) {
    const topic = topicMap.get(baselineId);
    if (!topic) {
      throw new Error(`Baseline topic '${baselineId}' not found in topics index.`);
    }

    selectedMap.set(topic.file_id, buildSelectedTopic(topic, ["selected_by_profile_baseline"]));
  }

  for (const topic of topicsIndex.topics) {
    if (!matchesApplicability(topic, input.family)) {
      continue;
    }

    if (!matchesCapability(topic, capabilities)) {
      continue;
    }

    const reasons = ["selected_by_capability"];
    if (topic.required) {
      reasons.push("selected_as_required");
    }

    const existing = selectedMap.get(topic.file_id);
    if (existing) {
      existing.reasons = Array.from(new Set([...existing.reasons, ...reasons]));
      continue;
    }

    selectedMap.set(topic.file_id, buildSelectedTopic(topic, reasons));
  }

  for (const selected of Array.from(selectedMap.values())) {
    const topic = topicMap.get(selected.file_id)!;

    for (const dependencyId of topic.requires) {
      const dependency = topicMap.get(dependencyId);
      if (!dependency) {
        if (rules.dependency_policy.missing_dependency === "fail") {
          throw new Error(`Missing required dependency '${dependencyId}' for topic '${topic.file_id}'.`);
        }

        continue;
      }

      const existingDependency = selectedMap.get(dependency.file_id);
      if (existingDependency) {
        existingDependency.reasons = Array.from(
          new Set([...existingDependency.reasons, "selected_as_dependency"])
        );
      } else {
        selectedMap.set(
          dependency.file_id,
          buildSelectedTopic(dependency, ["selected_as_dependency"])
        );
      }
    }
  }

  for (const selected of Array.from(selectedMap.values())) {
    const topic = topicMap.get(selected.file_id)!;

    for (const conflictId of topic.conflicts_with) {
      const conflict = selectedMap.get(conflictId);
      if (!conflict) {
        continue;
      }

      if (selected.required && conflict.required) {
        if (rules.conflict_resolution.strategy === "fail_on_required_conflict") {
          throw new Error(`Required conflict detected between '${selected.file_id}' and '${conflict.file_id}'.`);
        }
      }

      if (rules.conflict_resolution.optional_topic_policy === "drop_optional_conflicts") {
        if (!selected.required && conflict.required) {
          selectedMap.delete(selected.file_id);
          break;
        }

        if (selected.required && !conflict.required) {
          selectedMap.delete(conflict.file_id);
          continue;
        }

        if (!selected.required && !conflict.required) {
          if (selected.file_id.localeCompare(conflict.file_id) > 0) {
            selectedMap.delete(selected.file_id);
            break;
          }

          selectedMap.delete(conflict.file_id);
        }
      }
    }
  }

  const sorted = sortSelectedTopics(Array.from(selectedMap.values()), rules);

  logger.log("debug", "selection_plan_resolved", {
    profile_id: input.profileId,
    capability_count: capabilities.length,
    selected_topic_count: sorted.length
  });

  return {
    profile_id: input.profileId,
    capability_tags: capabilities,
    selected_topics: sorted
  };
}
