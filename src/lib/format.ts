import type { Feature, FeatureAttributes } from "../types";

/** Display text for an attribute, or "" when it is missing or a placeholder (-999, NOT AVAILABLE). */
export function displayValue(value: FeatureAttributes[string] | undefined): string {
  if (typeof value === "number") return value === -999 ? "" : value.toLocaleString();
  const text = (value ?? "").trim();
  return text === "NOT AVAILABLE" ? "" : text;
}

/**
 * One sentence saying how many rows are shown and how many match in total.
 * Rows are capped, so "shown" and "matching" are different numbers and the
 * total comes from a separate count query (null when that query failed).
 */
export function resultSummary(shown: number, total: number | null): string {
  const plural = (n: number) => (n === 1 ? "" : "s");
  if (shown === 0) {
    return total
      ? `${total.toLocaleString()} result${plural(total)} match, but no rows came back. Try again.`
      : "No results found. Try broadening your search.";
  }
  if (total === null) {
    return `Showing ${shown} result${plural(shown)}. The total number of matches could not be counted.`;
  }
  if (total > shown) {
    return `Showing ${shown.toLocaleString()} of ${total.toLocaleString()} matching result${plural(total)}.`;
  }
  return `Found ${shown} result${plural(shown)}.`;
}

export function featureName(feature: Feature): string {
  return displayValue(feature.attributes.NAME) || "Unknown";
}

export function featureLocation({ attributes: a }: Feature): string {
  return [a.CITY, a.STATE ?? a.STATE_ABBR].map(displayValue).filter(Boolean).join(", ");
}
