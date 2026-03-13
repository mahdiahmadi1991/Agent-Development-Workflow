export interface OperationalSelections {
  gitMode: "track" | "ignore";
}

export interface QuestionnaireOption {
  id: string;
  label: string;
  next: string;
}

export interface QuestionnaireSelectNode {
  id: string;
  type: "select";
  question: string;
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

export interface ProfileSelectionAnswers {
  answers: Record<string, string>;
}
