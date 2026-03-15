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

async function loadProfilesByFamily(
  assetRoot: string,
  family: string
): Promise<Array<{ profilePath: string; profile: ProfileDefinition }>> {
  const profileDir = path.join(assetRoot, "library", "profiles", family);
  const files = await fs.readdir(profileDir, { withFileTypes: true });
  const yamlFiles = files
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const loaded: Array<{ profilePath: string; profile: ProfileDefinition }> = [];
  for (const file of yamlFiles) {
    const profilePath = path.join(profileDir, file);
    const raw = await fs.readFile(profilePath, "utf8");
    const profile = parseProfile(raw);
    if (profile.family !== family) {
      throw new Error(
        `Profile family mismatch for '${profile.profile_id}'. Expected '${family}', got '${profile.family}'.`
      );
    }
    loaded.push({ profilePath, profile });
  }

  return loaded;
}

function dedupeStrings(items: string[]): string[] {
  return Array.from(new Set(items));
}

function normalizeProfileHint(hint: string): string {
  return hint.trim().replace(/_/g, "-");
}

function findProfileByHint(
  profiles: Array<{ profilePath: string; profile: ProfileDefinition }>,
  family: string,
  hint: string
): ProfileDefinition | undefined {
  const normalized = normalizeProfileHint(hint);
  const normalizedWithFamilyPrefix = normalized.startsWith(`${family}-`)
    ? normalized
    : `${family}-${normalized}`;

  return profiles.find((item) => {
    const profileId = item.profile.profile_id;
    if (profileId === normalized || profileId === normalizedWithFamilyPrefix) {
      return true;
    }

    const slug = profileId.replace(new RegExp(`^${family}-`), "");
    return slug === normalized;
  })?.profile;
}

async function resolveInheritedProfile(
  assetRoot: string,
  family: string,
  profile: ProfileDefinition
): Promise<ProfileDefinition> {
  if (!profile.inherits) {
    return profile;
  }

  const inheritedSlug = profile.inherits.replace(new RegExp(`^${family}-`), "");
  const baseProfile = await loadSingleProfileFile(assetRoot, family, inheritedSlug);

  if (baseProfile.family !== family) {
    throw new Error(
      `Base profile family mismatch for '${baseProfile.profile_id}'. Expected '${family}', got '${baseProfile.family}'.`
    );
  }

  const baseline_topics = dedupeStrings([...baseProfile.baseline_topics, ...profile.baseline_topics]);
  const default_capabilities = dedupeStrings([
    ...baseProfile.default_capabilities,
    ...profile.default_capabilities
  ]);

  return {
    ...profile,
    baseline_topics,
    default_capabilities
  };
}

function combineProfiles(family: string, profiles: ProfileDefinition[]): ProfileDefinition {
  const sortedProfiles = [...profiles].sort((left, right) => left.profile_id.localeCompare(right.profile_id));
  const combinedId = sortedProfiles.length === 1
    ? sortedProfiles[0]!.profile_id
    : `${family}-composed-${sortedProfiles.map((profile) => profile.profile_id.replace(`${family}-`, "")).join("+")}`;

  const baseline_topics = dedupeStrings(sortedProfiles.flatMap((profile) => profile.baseline_topics));
  const default_capabilities = dedupeStrings(sortedProfiles.flatMap((profile) => profile.default_capabilities));

  return {
    version: 1,
    profile_id: combinedId,
    family,
    questionnaire_ref: sortedProfiles[0]?.questionnaire_ref ?? "",
    baseline_topics,
    default_capabilities
  };
}

export async function resolveProfileFromHints(
  extensionPath: string,
  family: string,
  hints: string[]
): Promise<ProfileDefinition> {
  const assetRoot = await resolveOnboardingAssetRoot(extensionPath);
  const loaded = await loadProfilesByFamily(assetRoot, family);

  if (loaded.length === 0) {
    throw new Error(`No profile definitions found for family '${family}'.`);
  }

  const selected = hints
    .map((hint) => findProfileByHint(loaded, family, hint))
    .filter((profile): profile is ProfileDefinition => profile !== undefined);

  const uniqueSelected = dedupeStrings(selected.map((profile) => profile.profile_id))
    .map((profileId) => loaded.find((item) => item.profile.profile_id === profileId)!.profile);

  let effectiveProfiles = uniqueSelected;
  if (effectiveProfiles.length === 0) {
    const baseline = loaded.find((item) => item.profile.profile_id === `${family}-baseline`)?.profile;
    effectiveProfiles = [baseline ?? loaded[0]!.profile];
  }

  const resolvedProfiles: ProfileDefinition[] = [];
  for (const profile of effectiveProfiles) {
    const resolved = await resolveInheritedProfile(assetRoot, family, profile);
    resolvedProfiles.push(resolved);
  }

  return combineProfiles(family, resolvedProfiles);
}

export async function loadResolvedProfile(
  extensionPath: string,
  family: string,
  selectedProfileOptionId: string
): Promise<ProfileDefinition> {
  return resolveProfileFromHints(extensionPath, family, [normalizeOptionToProfileSlug(selectedProfileOptionId)]);
}
