import { checkFilter, checkFields, checkOrderBy } from "geoassist-hazard-proximity/core";
import type { FieldInfo } from "geoassist-hazard-proximity/core";
import type { Dataset, LLMQueryResult } from "../types";

export interface PreparedQuery {
  /** The query that will be sent: checked, with exact field spelling. */
  query: LLMQueryResult;
  /** True when closed hospitals were left out because the filter didn't mention STATUS. */
  openOnlyApplied: boolean;
  /** Values in an IN list that don't exist in the layer and matched nothing. */
  warnings: string[];
}

// The shared core writes its messages for an MCP client. This app has no such
// tool, so drop the sentence that points at one.
const reject = (message: string) =>
  new Error(`Rejected generated query: ${message.replace(/ Call get_dataset_schema[^.]*\./, "")}`);

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

  // outFields: "*" or a list of real fields.
  let outFields = "*";
  const requested = raw.outFields.split(",").map((f) => f.trim()).filter(Boolean);
  if (!requested.includes("*")) {
    const fields = checkFields(requested, names, []);
    if (!fields.ok) throw reject(fields.error);
    outFields = fields.list.join(",") || "*";
  }

  // ORDER BY: real fields with ASC or DESC only.
  const order = checkOrderBy(raw.orderByFields, names);
  if (!order.ok) throw reject(order.error);

  return {
    query: { ...raw, where: filter.where, outFields, orderByFields: order.orderBy || undefined },
    openOnlyApplied: filter.openOnlyApplied,
    warnings: filter.warnings,
  };
}
