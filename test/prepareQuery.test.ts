import { test } from "node:test";
import assert from "node:assert/strict";
import type { FieldInfo } from "geoassist-hazard-proximity/core";
import { prepareQuery } from "../src/lib/prepareQuery.ts";
import { describeSchema } from "../src/lib/schemaPrompt.ts";
import { DATASETS } from "../src/data/datasets.ts";
import type { LLMQueryResult } from "../src/types/index.ts";

const [hospitals, schools, cities] = DATASETS;

// A stand-in for the schema the app reads from the live layer.
const field = (name: string, extra: Partial<FieldInfo> = {}): FieldInfo => ({ name, type: "String", examples: [], ...extra });
const HOSPITAL_SCHEMA: FieldInfo[] = [
  ...["NAME", "CITY", "STATE", "OWNER", "BEDS"].map((n) => field(n)),
  field("STATUS", { examples: ["CLOSED", "OPEN"], all_values: true }),
  field("HELIPAD", { examples: ["N", "Y"], all_values: true }),
  field("TRAUMA", {
    examples: ["I", "LEVEL I", "LEVEL II", "NOT AVAILABLE"],
    all_values: true,
    value_groups: { LEVEL_I: { description: "Every Level I spelling.", values: ["I", "LEVEL I"] } },
  }),
];
const query = (over: Partial<LLMQueryResult>): LLMQueryResult => ({
  where: "1=1",
  outFields: "NAME,CITY,STATE",
  resultRecordCount: 20,
  summary: "",
  ...over,
});
const prepare = (over: Partial<LLMQueryResult>) => prepareQuery(hospitals, HOSPITAL_SCHEMA, query(over));

test("a good query comes back with exact field spelling and the open-only rule", () => {
  const r = prepare({ where: "state='CA' and beds>500", outFields: "name, beds", orderByFields: "beds desc" });
  assert.equal(r.query.where, "(STATE='CA' AND BEDS>500) AND STATUS = 'OPEN'");
  assert.equal(r.query.outFields, "NAME,BEDS");
  assert.equal(r.query.orderByFields, "BEDS DESC");
  assert.equal(r.openOnlyApplied, true);
});

test("closed hospitals are only included when the question is about STATUS", () => {
  assert.equal(prepare({ where: "1=1" }).query.where, "STATUS = 'OPEN'");
  const closed = prepare({ where: "STATUS = 'CLOSED'" });
  assert.equal(closed.query.where, "STATUS = 'CLOSED'");
  assert.equal(closed.openOnlyApplied, false);
  // Other datasets have no such rule.
  const schoolSchema = [field("NAME"), field("STATE")];
  assert.equal(prepareQuery(schools, schoolSchema, query({ outFields: "NAME" })).query.where, "1=1");
});

test("rejects fields that are not in the layer, with a suggestion", () => {
  assert.throws(() => prepare({ where: "TRAUMMA='LEVEL I'" }), /Unknown field 'TRAUMMA'\. Did you mean 'TRAUMA'\?/);
  assert.throws(() => prepare({ outFields: "NAME,PHONE" }), /Unknown output field 'PHONE'/);
  assert.throws(() => prepare({ orderByFields: "RANK DESC" }), /Unknown sort field 'RANK'/);
});

test("rejects a value that is not in a coded field", () => {
  assert.throws(() => prepare({ where: "HELIPAD = 'YES'" }), /'YES' is not a value of HELIPAD/);
  // IN lists run as long as one value exists, and say which matched nothing.
  const r = prepare({ where: "TRAUMA IN ('LEVEL I', 'LEVEL  I')" });
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /'LEVEL {2}I' is not a value of TRAUMA/);
});

test("rejects statements, comments, subqueries and odd ORDER BY", () => {
  for (const where of ["NAME='x'; DROP TABLE t", "NAME='x' -- c", "BEDS IN (SELECT BEDS FROM t)", "1=1 UNION ALL"]) {
    assert.throws(() => prepare({ where }), /Rejected generated query/, where);
  }
  assert.throws(() => prepare({ orderByFields: "BEDS DESC NULLS LAST" }), /Invalid ORDER BY/);
});

test("error text does not point at a tool this app doesn't have", () => {
  assert.throws(
    () => prepare({ where: "TRAUMMA='LEVEL I'" }),
    (err: Error) => !err.message.includes("get_dataset_schema")
  );
});

test("SQL words inside a quoted value are data, not SQL", () => {
  // 101 hospitals in the layer are named "Select Specialty Hospital ...".
  assert.doesNotThrow(() => prepare({ where: "NAME LIKE '%SELECT SPECIALTY%'" }));
});

test("every pre-translated example names only fields its layer has", () => {
  // Field names of the three live layers, as read on 2026-11-10.
  const layerFields = {
    hospitals: ["NAME", "CITY", "STATE", "BEDS", "TRAUMA", "HELIPAD", "OWNER", "STATUS"],
    schools: ["NAME", "CITY", "STATE", "COUNTY", "LEVEL_", "ENROLLMENT", "FT_TEACHER"],
    cities: ["NAME", "STATE_ABBR", "POPULATION", "CAPITAL"],
  };
  for (const dataset of [hospitals, schools, cities]) {
    const schema = layerFields[dataset.id].map((n) => field(n));
    for (const example of dataset.examples) {
      assert.doesNotThrow(() => prepareQuery(dataset, schema, example.query), `${dataset.id}: ${example.question}`);
    }
  }
});

test("datasets come from the shared core, and only cities is Living Atlas", () => {
  assert.deepEqual(
    DATASETS.map((d) => [d.id, d.core.source.living_atlas]),
    [["hospitals", false], ["schools", false], ["cities", true]]
  );
  for (const d of DATASETS) assert.match(d.core.url, /^https:\/\/services\.arcgis\.com\/.+\/FeatureServer\/\d+$/);
});

test("the model is shown complete value lists and named groups", () => {
  const text = describeSchema(HOSPITAL_SCHEMA);
  assert.match(text, /- HELIPAD \(String\) all values: 'N', 'Y'/);
  assert.match(text, /group LEVEL_I: TRAUMA IN \('I', 'LEVEL I'\)/);
  assert.match(text, /- NAME \(String\)$/m);
});
