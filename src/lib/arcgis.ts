import type { Dataset, LLMQueryResult, Feature, ArcGISQueryResponse } from "../types";

export async function queryFeatures(
  dataset: Dataset,
  query: LLMQueryResult,
  signal: AbortSignal
): Promise<Feature[]> {
  const params = new URLSearchParams({
    where: query.where,
    outFields: query.outFields,
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
    resultRecordCount: String(query.resultRecordCount),
  });
  if (query.orderByFields) params.append("orderByFields", query.orderByFields);

  const response = await fetch(`${dataset.url}/query?${params}`, { signal });
  if (!response.ok) throw new Error(`ArcGIS request failed (${response.status})`);

  const data: ArcGISQueryResponse = await response.json();
  if (data.error) throw new Error(`ArcGIS error: ${data.error.message}`);

  return data.features ?? [];
}
