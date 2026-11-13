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
  assert.equal(r.query.outFields, "NAME,BEDS,CITY,STATE");
  assert.equal(r.query.orderByFields, "BEDS DESC");
  assert.equal(r.openOnlyApplied, true);
});

test("closed hospitals are only included when the question is about STATUS", () => {
  assert.equal(prepare({ where: "1=1" }).query.where, "STATUS = 'OPEN'");
  const closed = prepare({ where: "STATUS = 'CLOSED'" });
  assert.equal(closed.query.where, "STATUS = 'CLOSED'");
  assert.equal(closed.openOnlyApplied, false);
  // Naming the field without asking for another status keeps the rule on.
  const named = prepare({ where: "STATE='TX' AND STATUS IS NOT NULL" });
  assert.equal(named.query.where, "(STATE='TX' AND STATUS IS NOT NULL) AND STATUS = 'OPEN'");
  assert.equal(named.openOnlyApplied, true);
  // Saying OPEN outright still tells the user closed hospitals are left out.
  assert.equal(prepare({ where: "STATUS = 'OPEN'" }).openOnlyApplied, true);
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

test("an unknown value is refused only when every matching row needs it", () => {
  // Below an OR the rest may still match: a warning.
  const r = prepare({ where: "HELIPAD = 'YES' OR STATE = 'CA'" });
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /'YES' is not a value of HELIPAD.*that part of the filter matches nothing/);
  // Joined by AND only, even next to a NOT on another field: it can match nothing.
  assert.throws(() => prepare({ where: "HELIPAD = 'YES' AND NOT BEDS > 5" }), /'YES' is not a value of HELIPAD/);
  // Under NOT it leaves nothing out, like HELIPAD <> 'YES', so it is not checked.
  assert.deepEqual(prepare({ where: "NOT (HELIPAD = 'YES')" }).warnings, []);
});

test("an empty string is a real value: cities that are not capitals", () => {
  const citySchema = [field("NAME"), field("STATE_ABBR"), field("CAPITAL", { examples: ["", "National", "State"], all_values: true })];
  const r = prepareQuery(cities, citySchema, query({ where: "CAPITAL = ''", outFields: "NAME,STATE_ABBR" }));
  assert.equal(r.query.where, "CAPITAL = ''");
  assert.deepEqual(r.warnings, []);
});

test("the name and place fields are always asked for, so a result card is never 'Unknown'", () => {
  // The model listed only BEDS: the card still needs NAME, CITY and STATE.
  assert.equal(prepare({ outFields: "BEDS" }).query.outFields, "BEDS,NAME,CITY,STATE");
  // Only fields the layer has are added (cities use STATE_ABBR).
  const citySchema = [field("NAME"), field("STATE_ABBR"), field("POPULATION")];
  assert.equal(prepareQuery(cities, citySchema, query({ outFields: "POPULATION" })).query.outFields, "POPULATION,NAME,STATE_ABBR");
});

test("named output fields are checked even beside a star", () => {
  assert.equal(prepare({ outFields: "*" }).query.outFields, "*");
  assert.equal(prepare({ outFields: "NAME,*" }).query.outFields, "*");
  assert.equal(prepare({ outFields: "" }).query.outFields, "*");
  assert.throws(() => prepare({ outFields: "*,BOGUS_FIELD" }), /Unknown output field 'BOGUS_FIELD'/);
});

test("every pre-translated example passes the gate", () => {
  // Field names only: the stand-in schema has no value lists.
  const names: Record<string, string[]> = {
    hospitals: ["NAME", "CITY", "STATE", "BEDS", "TRAUMA", "HELIPAD", "OWNER", "STATUS"],
    schools: ["NAME", "CITY", "STATE", "COUNTY", "LEVEL_", "ENROLLMENT", "FT_TEACHER"],
    cities: ["NAME", "STATE_ABBR", "POPULATION", "CAPITAL"],
  };
  for (const dataset of DATASETS) {
    const schema = names[dataset.id].map((n) => field(n));
    for (const example of dataset.examples) {
      assert.doesNotThrow(() => prepareQuery(dataset, schema, example.query), example.question);
    }
  }
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

test("values with an apostrophe are shown to the model as SQL literals", () => {
  const text = describeSchema([{ name: "CITY", type: "String", examples: ["O'FALLON", "AUSTIN"], all_values: true }]);
  assert.match(text, /all values: 'O''FALLON', 'AUSTIN'/);
});

test("a filter that uses STATUS in a form the check can't read keeps its rows and says why", () => {
  const r = prepare({ where: "STATUS LIKE 'C%'" });
  assert.equal(r.query.where, "STATUS LIKE 'C%'");
  assert.equal(r.openOnlyApplied, false);
  assert.match(r.warnings.join(" "), /were not left out/);
  assert.match(r.warnings.join(" "), /ask again and say open hospitals only/);
  // A top-level AND STATUS = 'OPEN' already limits the answer to open hospitals.
  const both = prepare({ where: "STATUS LIKE 'O%' AND STATUS = 'OPEN'" });
  assert.equal(both.openOnlyApplied, true);
  assert.deepEqual(both.warnings, []);
});
