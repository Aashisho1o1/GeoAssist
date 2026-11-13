import { checkFilter, checkFields, checkOrderBy } from "geoassist-hazard-proximity/core";
import type { FieldInfo } from "geoassist-hazard-proximity/core";
import type { Dataset, LLMQueryResult } from "../types";

export interface PreparedQuery {
  /** The query that will be sent: checked, with exact field spelling. */
  query: LLMQueryResult;
  /** True when the answer is limited to hospitals marked OPEN in the snapshot. */
  openOnlyApplied: boolean;
  /** Values that don't exist in the layer, or could not be checked. */
  warnings: string[];
}

const reject = (message: string) => new Error(`Rejected generated query: ${message}`);

// Every result card shows a name and a place (see format.ts), so these are
// always asked for when the layer has them, whatever the model listed.
const IDENTITY_FIELDS = ["NAME", "CITY", "STATE", "STATE_ABBR"];

/**
 * Runs a generated query through the same gate the geoassist-mcp server
 * uses, against the schema read from the live layer. Throws if any part is
 * refused, so a rejected query is never sent to ArcGIS.
 */
export function prepareQuery(dataset: Dataset, schema: FieldInfo[], raw: LLMQueryResult): PreparedQuery {
  const names = schema.map((f) => f.name);

  // WHERE: field names, SQL shape, values of coded fields, open-only default.
  const filter = checkFilter(dataset.core, schema, raw.where);
  if (!filter.ok) throw reject(filter.error);

  // outFields: "*" or a list of real fields, plus the identity fields. Named
  // fields are checked even when "*" is also present.
  const requested = raw.outFields.split(",").map((f) => f.trim()).filter(Boolean);
  const named = requested.filter((f) => f !== "*");
  const fields = checkFields(named, names, IDENTITY_FIELDS);
  if (!fields.ok) throw reject(fields.error);
  const outFields = named.length === 0 || requested.includes("*") ? "*" : fields.list.join(",");

  // ORDER BY: real fields with ASC or DESC only.
  const order = checkOrderBy(raw.orderByFields, names);
  if (!order.ok) throw reject(order.error);

  return {
    query: { ...raw, where: filter.where, outFields, orderByFields: order.orderBy || undefined },
    openOnlyApplied: filter.openOnlyApplied,
    // The person asks in plain English, so the advice is about the question, not SQL.
    warnings: filter.statusUnread
      ? [...filter.warnings, "To leave closed hospitals out, ask again and say open hospitals only."]
      : filter.warnings,
  };
}
