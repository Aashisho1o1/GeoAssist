export interface Dataset {
  id: string;
  name: string;
  label: string;
  description: string;
  impact: string;
  url: string;
  fields: string[];
  examples: Example[];
  valueHints: string[];
  icon: string;
  color: string;
  source: DataSource;
}

/** Where a dataset comes from and who hosts the copy this app queries. */
export interface DataSource {
  origin: string;
  hostedBy: string;
  itemUrl: string;
  livingAtlas: boolean;
}

/** What one search returned: the rows shown, and how many rows match in total. */
export interface QueryResult {
  features: Feature[];
  /** Count of every matching row, or null when the count request failed. */
  total: number | null;
}

export interface Example {
  question: string;
  query: LLMQueryResult;
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
}

export interface ArcGISQueryResponse {
  features?: Feature[];
  count?: number;
  error?: {
    message: string;
    code: number;
  };
}
