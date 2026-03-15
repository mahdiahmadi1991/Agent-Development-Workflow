export interface OperationalSelections {
  gitMode: "track" | "ignore";
}

export type QuestionnaireSelectionMode = "single" | "multi";

export interface QuestionnaireRuleCondition {
  fact: string;
  eq?: string | number | boolean;
  in?: Array<string | number | boolean>;
  exists?: boolean;
}

export interface QuestionnaireRuleExpression {
  all?: QuestionnaireRuleCondition[];
  any?: QuestionnaireRuleCondition[];
}

export interface QuestionnaireOptionEmits {
  capability_tags?: string[];
  profile_hints?: string[];
  topic_tags?: string[];
  family_keys?: string[];
}

export interface QuestionnaireOption {
  id: string;
  label: string;
  description?: string;
  next?: string;
  emits?: QuestionnaireOptionEmits;
  visible_when?: QuestionnaireRuleExpression;
  enabled_when?: QuestionnaireRuleExpression;
}

export interface QuestionnaireSelectNode {
  id: string;
  type: "select";
  question: string;
  selection_mode: QuestionnaireSelectionMode;
  min_select?: number;
  max_select?: number;
  visible_when?: QuestionnaireRuleExpression;
  required_when?: QuestionnaireRuleExpression;
  options: QuestionnaireOption[];
}

export interface QuestionnaireEndNode {
  id: string;
  type: "end";
}

export type QuestionnaireNode = QuestionnaireSelectNode | QuestionnaireEndNode;

export interface QuestionnaireFlow {
  version: number;
  family: string;
  entrypoint: string;
  nodes: QuestionnaireNode[];
}

export interface QuestionnaireAssetLoad {
  family: string;
  indexPath: string;
  flowPath: string;
  flow: QuestionnaireFlow;
}

export interface QuestionnaireSelectionReason {
  kind: "selected_option" | "node_hidden_by_rule" | "option_hidden_by_rule";
  node_id: string;
  option_id?: string;
  detail?: string;
}

export interface ProfileSelectionAnswers {
  answers: Record<string, string[]>;
  selected_paths: string[];
  capability_tags: string[];
  profile_hints: string[];
  topic_tags: string[];
  family_keys: string[];
  why_selected: QuestionnaireSelectionReason[];
  why_skipped: QuestionnaireSelectionReason[];
}
