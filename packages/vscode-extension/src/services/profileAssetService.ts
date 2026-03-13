import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parse } from "yaml";

import { ProfileDefinition } from "../contracts/selection";
import { resolveOnboardingAssetRoot } from "./onboardingAssetRootResolver";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseProfile(rawYaml: string): ProfileDefinition {
  const parsed = parse(rawYaml) as Record<string, unknown>;

  if (
    !parsed ||
    typeof parsed.version !== "number" ||
    !isString(parsed.profile_id) ||
    !isString(parsed.family) ||
    !isString(parsed.questionnaire_ref) ||
    !isStringArray(parsed.baseline_topics) ||
    !isStringArray(parsed.default_capabilities)
  ) {
    throw new Error("Invalid profile definition document.");
  }

  const inherits = parsed.inherits;
  if (inherits !== undefined && !isString(inherits)) {
    throw new Error("Invalid profile definition: 'inherits' must be string when present.");
  }

  return {
    version: parsed.version,
    profile_id: parsed.profile_id,
    family: parsed.family,
    inherits,
    questionnaire_ref: parsed.questionnaire_ref,
    baseline_topics: parsed.baseline_topics,
    default_capabilities: parsed.default_capabilities
  };
}

function normalizeOptionToProfileSlug(selectedProfileOptionId: string): string {
  return selectedProfileOptionId.replace(/_/g, "-");
}

async function loadSingleProfileFile(
  assetRoot: string,
  family: string,
  profileFileSlug: string
): Promise<ProfileDefinition> {
  const profilePath = path.join(assetRoot, "library", "profiles", family, `${profileFileSlug}.yaml`);
  const raw = await fs.readFile(profilePath, "utf8");
  return parseProfile(raw);
}

export async function loadResolvedProfile(
  extensionPath: string,
  family: string,
  selectedProfileOptionId: string
): Promise<ProfileDefinition> {
  const assetRoot = await resolveOnboardingAssetRoot(extensionPath);

  const slug = normalizeOptionToProfileSlug(selectedProfileOptionId);
  const ownProfile = await loadSingleProfileFile(assetRoot, family, slug);

  if (ownProfile.family !== family) {
    throw new Error(
      `Profile family mismatch for '${ownProfile.profile_id}'. Expected '${family}', got '${ownProfile.family}'.`
    );
  }

  if (!ownProfile.inherits) {
    return ownProfile;
  }

  const inheritedSlug = ownProfile.inherits.replace(new RegExp(`^${family}-`), "");
  const baseProfile = await loadSingleProfileFile(assetRoot, family, inheritedSlug);

  if (baseProfile.family !== family) {
    throw new Error(
      `Base profile family mismatch for '${baseProfile.profile_id}'. Expected '${family}', got '${baseProfile.family}'.`
    );
  }

  const baseline_topics = Array.from(new Set([...baseProfile.baseline_topics, ...ownProfile.baseline_topics]));
  const default_capabilities = Array.from(
    new Set([...baseProfile.default_capabilities, ...ownProfile.default_capabilities])
  );

  return {
    ...ownProfile,
    baseline_topics,
    default_capabilities
  };
}
