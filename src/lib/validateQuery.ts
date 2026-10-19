import type { LLMQueryResult } from "../types";

// Words allowed in a WHERE clause besides field names.
const SQL_WORDS = new Set([
  "AND", "OR", "NOT", "IN", "LIKE", "IS", "NULL", "BETWEEN", "ESCAPE",
  "UPPER", "LOWER", "TRIM", "CHAR_LENGTH",
]);
const FORBIDDEN = /;|--|\/\*|\bSELECT\b/i;

// Bare words in a clause, ignoring the contents of quoted string literals.
function identifiers(sql: string): string[] {
  return sql.replace(/'(?:[^']|'')*'/g, "''").match(/[A-Za-z_]\w*/g) ?? [];
}

/** Throws if the LLM-generated query uses unknown fields or unsafe SQL. */
export function validateQuery(query: LLMQueryResult, fields: string[]): void {
  const allowed = new Set(fields.map((f) => f.toUpperCase()));
  const unknown = new Set<string>();
  const check = (name: string) => {
    if (!allowed.has(name.toUpperCase())) unknown.add(name);
  };

  if (FORBIDDEN.test(query.where)) {
    throw new Error("Rejected generated query: WHERE clause contains disallowed SQL.");
  }
  identifiers(query.where)
    .filter((word) => !SQL_WORDS.has(word.toUpperCase()))
    .forEach(check);

  query.outFields
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f !== "*")
    .forEach(check);

  for (const part of (query.orderByFields ?? "").split(",")) {
    const [field, direction, ...rest] = part.trim().split(/\s+/);
    if (!field) continue;
    check(field);
    if (rest.length || (direction && !/^(ASC|DESC)$/i.test(direction))) {
      throw new Error(`Rejected generated query: invalid ORDER BY "${part.trim()}".`);
    }
  }

  if (unknown.size) {
    throw new Error(`Rejected generated query: unknown field(s) ${[...unknown].join(", ")}.`);
  }
}
