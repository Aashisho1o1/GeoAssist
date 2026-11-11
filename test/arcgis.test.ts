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
let methods: string[] = [];
function mockArcGIS(respond: (url: URL) => Response): URL[] {
  const calls: URL[] = [];
  methods = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    // A POST carries the same parameters in its body.
    const url = new URL(init?.method === "POST" ? `${String(input)}?${String(init.body)}` : String(input));
    calls.push(url);
    methods.push(init?.method ?? "GET");
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

test("a long filter is sent as a POST, for both the rows and the count", async () => {
  const where = `NAME = '${"&".repeat(800)}'`;
  const calls = mockArcGIS((url) => (url.searchParams.get("returnCountOnly") ? json({ count: 0 }) : json(rows(0))));
  await queryFeatures(hospitals, { ...query, where }, signal);
  assert.deepEqual(methods, ["POST", "POST"]);
  for (const u of calls) assert.equal(u.searchParams.get("where"), where);
});

test("a failed count is unknown, not zero, and the rows still come back", async () => {
  mockArcGIS((url) => (url.searchParams.get("returnCountOnly") ? json({}, 500) : json(rows(50))));
  const result = await queryFeatures(hospitals, query, signal);
  assert.equal(result.features.length, 50);
  assert.equal(result.total, null);
});

test("rows that came back under the cap are the total, even if the count failed", async () => {
  mockArcGIS((url) => (url.searchParams.get("returnCountOnly") ? json({}, 500) : json(rows(3))));
  assert.equal((await queryFeatures(hospitals, query, signal)).total, 3);
  // Not when the service says it held rows back.
  mockArcGIS((url) => (url.searchParams.get("returnCountOnly") ? json({}, 500) : json({ ...rows(3), exceededTransferLimit: true })));
  assert.equal((await queryFeatures(hospitals, query, signal)).total, null);
});

test("a count smaller than the rows shown is raised to the rows shown", async () => {
  mockArcGIS((url) => (url.searchParams.get("returnCountOnly") ? json({ count: 0 }) : json(rows(5))));
  assert.equal((await queryFeatures(hospitals, query, signal)).total, 5);
});

test("a count request that never answers does not hold the rows back", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.fetch = ((input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (!url.searchParams.get("returnCountOnly")) return Promise.resolve(json(rows(50)));
    // Hangs until its own deadline aborts it.
    return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
  }) as typeof fetch;
  const pending = queryFeatures(hospitals, query, signal);
  await new Promise((r) => setImmediate(r));
  t.mock.timers.tick(5_000);
  const result = await pending;
  assert.equal(result.features.length, 50);
  assert.equal(result.total, null);
});

test("a rows request that never answers fails with a message, and a cancelled search stays cancelled", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const hang = ((_: string | URL, init?: RequestInit) =>
    new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as typeof fetch;
  globalThis.fetch = hang;
  const pending = queryFeatures(hospitals, query, signal);
  const failed = assert.rejects(pending, /did not answer within 10 seconds/);
  await new Promise((r) => setImmediate(r));
  t.mock.timers.tick(10_000);
  await failed;

  const search = new AbortController();
  const cancelled = assert.rejects(queryFeatures(hospitals, query, search.signal), (e: Error) => !/did not answer/.test(e.message));
  search.abort();
  await cancelled;
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
  assert.equal(resultSummary(0, null), "No results found. Try broadening your search.");
  assert.equal(resultSummary(0, 4), "4 results match, but no rows came back. Try again.");
  assert.match(resultSummary(50, null), /Showing 50 results\. The total number of matches could not be counted\./);
});
