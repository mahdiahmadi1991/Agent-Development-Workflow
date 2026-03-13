export interface TopicIndexEntry {
  file_id: string;
  path: string;
  category: string;
  severity: string;
  required: boolean;
  tags: string[];
  applicability: Record<string, unknown>;
  requires: string[];
  conflicts_with: string[];
}

export interface TopicsIndexDocument {
  version: number;
  topics: TopicIndexEntry[];
}

export interface ResolverRules {
  deterministic_sort: string[];
  conflict_resolution: {
    strategy: "fail_on_required_conflict" | string;
    optional_topic_policy: "drop_optional_conflicts" | string;
  };
  dependency_policy: {
    missing_dependency: "fail" | string;
  };
}

export interface ProfileDefinition {
  version: number;
  profile_id: string;
  family: string;
  inherits?: string;
  questionnaire_ref: string;
  baseline_topics: string[];
  default_capabilities: string[];
}

export interface SelectedTopic {
  file_id: string;
  path: string;
  category: string;
  required: boolean;
  reasons: string[];
}

export interface SelectionPlan {
  profile_id: string;
  capability_tags: string[];
  selected_topics: SelectedTopic[];
}
