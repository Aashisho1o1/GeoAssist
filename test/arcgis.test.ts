import { test } from "node:test";
import assert from "node:assert/strict";
import { queryFeatures } from "../src/lib/arcgis.ts";
import { resultSummary } from "../src/lib/format.ts";
import { DATASETS } from "../src/data/datasets.ts";

const hospitals = DATASETS[0];
const query = { where: "STATE='TX'", outFields: "NAME,CITY,STATE", resultRecordCount: 50, summary: "" };
const signal = new AbortController().signal;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

// Replaces fetch with a fake ArcGIS service and records the URLs requested.
function mockArcGIS(respond: (url: URL) => Response): URL[] {
  const calls: URL[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    return respond(url);
  }) as typeof fetch;
  return calls;
}

const rows = (n: number) => ({ features: Array.from({ length: n }, (_, i) => ({ attributes: { NAME: `H${i}` } })) });

test("reports the total from a count query, not the number of capped rows", async () => {
  const calls = mockArcGIS((url) => (url.searchParams.get("returnCountOnly") ? json({ count: 798 }) : json(rows(50))));
  const result = await queryFeatures(hospitals, query, signal);
  assert.equal(result.features.length, 50);
  assert.equal(result.total, 798);
  const count = calls.find((u) => u.searchParams.get("returnCountOnly"))!;
  assert.equal(count.searchParams.get("where"), "STATE='TX'"); // same filter as the rows
});

test("a failed count is unknown, not zero, and the rows still come back", async () => {
  mockArcGIS((url) => (url.searchParams.get("returnCountOnly") ? json({}, 500) : json(rows(3))));
  const result = await queryFeatures(hospitals, query, signal);
  assert.equal(result.features.length, 3);
  assert.equal(result.total, null);
});

test("an ArcGIS error sent with HTTP 200 is still an error", async () => {
  mockArcGIS(() => json({ error: { code: 400, message: "Invalid query" } }));
  await assert.rejects(queryFeatures(hospitals, query, signal), /Invalid query/);
});

test("the summary never presents capped rows as the total", () => {
  assert.equal(resultSummary(50, 798), "Showing 50 of 798 matching results.");
  assert.equal(resultSummary(8, 8), "Found 8 results.");
  assert.equal(resultSummary(1, 1), "Found 1 result.");
  assert.equal(resultSummary(0, 0), "No results found. Try broadening your search.");
  assert.match(resultSummary(50, null), /Showing 50 results\. The total number of matches could not be counted\./);
});
