import { arcgisRequest } from "geoassist-hazard-proximity/core";
import type { Dataset, LLMQueryResult, QueryResult, ArcGISQueryResponse } from "../types";

const ROWS_DEADLINE_MS = 10_000;
const COUNT_DEADLINE_MS = 5_000;

/**
 * Fetches JSON, giving up after `deadlineMs` or when the caller's signal
 * aborts, whichever comes first. A request that never answers would
 * otherwise leave the search spinning with no way to try again.
 */
async function getJson(url: string, signal: AbortSignal, deadlineMs: number): Promise<ArcGISQueryResponse> {
  const request = new AbortController();
  const stop = () => request.abort();
  if (signal.aborted) stop();
  signal.addEventListener("abort", stop);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, deadlineMs);
  try {
    // A long filter goes as a POST: ArcGIS Online refuses GET URLs past about 2,000 characters.
    const req = arcgisRequest(url);
    const response = await fetch(req.url, { ...req.init, signal: request.signal });
    if (!response.ok) throw new Error(`ArcGIS request failed (${response.status})`);
    // ArcGIS reports many errors with HTTP 200 and an error object in the body.
    const data: ArcGISQueryResponse = await response.json();
    if (data.error) throw new Error(`ArcGIS error: ${data.error.message}`);
    return data;
  } catch (err) {
    if (timedOut) throw new Error(`ArcGIS did not answer within ${deadlineMs / 1000} seconds. Try again.`);
    throw err;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
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

  const [rows, counted] = await Promise.all([
    getJson(`${dataset.core.url}/query?${params}`, signal, ROWS_DEADLINE_MS),
    // A failed or slow count must not hide the rows. It is reported as
    // unknown (null), never as 0, and it gets a shorter deadline than the rows.
    getJson(`${dataset.core.url}/query?${countParams}`, signal, COUNT_DEADLINE_MS)
      .then((data) => (typeof data.count === "number" ? data.count : null))
      .catch(() => null),
  ]);
  if (signal.aborted) throw new DOMException("The search was cancelled.", "AbortError");

  const features = rows.features ?? [];
  // The two requests can disagree, or the count can be missing. The rows are
  // proof of at least that many matches, and rows that came back under the
  // cap are all of them.
  let total = counted;
  const underCap = features.length < query.resultRecordCount && !rows.exceededTransferLimit;
  if (total === null && underCap) total = features.length;
  if (total !== null && total < features.length) total = features.length;

  return { features, total };
}
