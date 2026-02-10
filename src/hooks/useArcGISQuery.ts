import { useState, useCallback } from "react";
import type { Dataset, LLMQueryResult, Feature, ArcGISQueryResponse } from "../types";

interface UseArcGISQueryReturn {
  executeQuery: (dataset: Dataset, queryParams: LLMQueryResult) => Promise<Feature[]>;
  loading: boolean;
  error: string | null;
}

export function useArcGISQuery(): UseArcGISQueryReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeQuery = useCallback(
    async (dataset: Dataset, queryParams: LLMQueryResult): Promise<Feature[]> => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          where: queryParams.where || "1=1",
          outFields: queryParams.outFields || "*",
          returnGeometry: "true",
          outSR: "4326",
          f: "json",
          resultRecordCount: String(queryParams.resultRecordCount || 20),
        });

        if (queryParams.orderByFields) {
          params.append("orderByFields", queryParams.orderByFields);
        }

        const response = await fetch(`${dataset.url}/query?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Network error: ${response.status}`);
        }

        const data: ArcGISQueryResponse = await response.json();

        if (data.error) {
          throw new Error(`ArcGIS Error: ${data.error.message}`);
        }

        return data.features || [];
      } catch (err) {
        const message = err instanceof Error ? err.message : "Query failed";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { executeQuery, loading, error };
}
