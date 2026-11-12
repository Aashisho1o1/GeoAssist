import type { Dataset as CoreDataset, DatasetId } from "geoassist-hazard-proximity/core";

export interface Dataset {
  id: DatasetId;
  name: string;
  label: string;
  description: string;
  impact: string;
  /**
   * The layer itself: URL, coded fields, value groups and data source. Shared
   * with the geoassist-mcp server, so both projects query the same layers.
   */
  core: CoreDataset;
  examples: Example[];
  /** Hand-written notes for the model about things the live schema can't show. */
  notes: string[];
  icon: string;
  color: string;
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
  exceededTransferLimit?: boolean;
  error?: {
    message: string;
    code: number;
  };
}
