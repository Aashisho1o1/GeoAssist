import type { Dataset, LLMQueryResult, QueryResult, ArcGISQueryResponse } from "../types";

async function getJson(url: string, signal: AbortSignal): Promise<ArcGISQueryResponse> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`ArcGIS request failed (${response.status})`);
  // ArcGIS reports many errors with HTTP 200 and an error object in the body.
  const data: ArcGISQueryResponse = await response.json();
  if (data.error) throw new Error(`ArcGIS error: ${data.error.message}`);
  return data;
}

/**
 * Runs the query twice in parallel: once for the rows to show (capped at
 * resultRecordCount) and once with returnCountOnly for the number of rows
 * that match in total. The cap means the rows alone can't say how many
 * matches exist, so the count is what the UI reports.
 */
export async function queryFeatures(
  dataset: Dataset,
  query: LLMQueryResult,
  signal: AbortSignal
): Promise<QueryResult> {
  const params = new URLSearchParams({
    where: query.where,
    outFields: query.outFields,
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
    resultRecordCount: String(query.resultRecordCount),
  });
  if (query.orderByFields) params.append("orderByFields", query.orderByFields);

  const countParams = new URLSearchParams({ where: query.where, returnCountOnly: "true", f: "json" });

  const [rows, total] = await Promise.all([
    getJson(`${dataset.core.url}/query?${params}`, signal),
    // A failed count must not hide the rows. It is reported as unknown (null),
    // never as 0. An aborted search still rejects through the rows request.
    getJson(`${dataset.core.url}/query?${countParams}`, signal)
      .then((data) => (typeof data.count === "number" ? data.count : null))
      .catch(() => null),
  ]);

  return { features: rows.features ?? [], total };
}
