import { test } from "node:test";
import assert from "node:assert/strict";
import { validateQuery } from "../src/lib/validateQuery.ts";
import { DATASETS } from "../src/data/datasets.ts";
import type { LLMQueryResult } from "../src/types/index.ts";

const FIELDS = ["NAME", "CITY", "STATE", "BEDS", "TRAUMA"];
const query = (over: Partial<LLMQueryResult>): LLMQueryResult => ({
  where: "1=1",
  outFields: "NAME,CITY,STATE",
  resultRecordCount: 20,
  summary: "",
  ...over,
});

test("accepts a plain filter, in any letter case", () => {
  assert.doesNotThrow(() => validateQuery(query({ where: "state='CA' and Beds>500", orderByFields: "BEDS DESC" }), FIELDS));
  assert.doesNotThrow(() => validateQuery(query({ where: "UPPER(NAME) LIKE '%MERCY%'", outFields: "*" }), FIELDS));
});

test("rejects fields that are not in the layer", () => {
  assert.throws(() => validateQuery(query({ where: "TRAUMMA='LEVEL I'" }), FIELDS), /unknown field\(s\) TRAUMMA/);
  assert.throws(() => validateQuery(query({ outFields: "NAME,PHONE" }), FIELDS), /PHONE/);
  assert.throws(() => validateQuery(query({ orderByFields: "RANK DESC" }), FIELDS), /RANK/);
});

test("rejects statements, comments and subqueries", () => {
  for (const where of [
    "NAME='x'; DROP TABLE t",
    "NAME='x' -- comment",
    "NAME='x' /* comment */",
    "BEDS IN (SELECT BEDS FROM t)",
    "1=1 UNION ALL",
  ]) {
    assert.throws(() => validateQuery(query({ where }), FIELDS), /Rejected/, where);
  }
});

test("rejects an ORDER BY that is more than field plus direction", () => {
  assert.throws(() => validateQuery(query({ orderByFields: "BEDS DESC NULLS LAST" }), FIELDS), /invalid ORDER BY/);
  assert.throws(() => validateQuery(query({ orderByFields: "BEDS SIDEWAYS" }), FIELDS), /invalid ORDER BY/);
});

test("SQL words inside a quoted value are data, not SQL", () => {
  // 101 hospitals in the layer are named "Select Specialty Hospital ...".
  assert.doesNotThrow(() => validateQuery(query({ where: "NAME LIKE '%SELECT SPECIALTY%'" }), FIELDS));
  assert.doesNotThrow(() => validateQuery(query({ where: "NAME = 'ST. MARY''S; EAST -- ANNEX'" }), FIELDS));
  // The same words outside quotes are still refused.
  assert.throws(() => validateQuery(query({ where: "NAME = 'x' OR SELECT" }), FIELDS), /disallowed SQL/);
});

test("every pre-translated example passes its own dataset's validator", () => {
  for (const dataset of DATASETS) {
    for (const example of dataset.examples) {
      assert.doesNotThrow(() => validateQuery(example.query, dataset.fields), `${dataset.id}: ${example.question}`);
    }
  }
});

test("only the cities dataset is labelled Living Atlas", () => {
  assert.deepEqual(
    DATASETS.map((d) => [d.id, d.source.livingAtlas]),
    [["hospitals", false], ["schools", false], ["cities", true]]
  );
});
