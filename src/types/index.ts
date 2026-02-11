export interface Dataset {
  id: string;
  name: string;
  label: string;
  description: string;
  impact: string;
  url: string;
  fields: string[];
  keyFields: string;
  exampleQuestions: string[];
  icon: string;
  color: string;
}

export interface LLMQueryResult {
  where: string;
  outFields: string;
  orderByFields?: string;
  resultRecordCount: number;
  summary: string;
}

export interface FeatureAttributes {
  [key: string]: string | number | null;
}

export interface FeatureGeometry {
  x: number;
  y: number;
}

export interface Feature {
  attributes: FeatureAttributes;
  geometry?: FeatureGeometry | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  count?: number;
  isError?: boolean;
  query?: LLMQueryResult;
}

export interface ArcGISQueryResponse {
  features: Feature[];
  error?: {
    message: string;
    code: number;
  };
}
