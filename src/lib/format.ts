import type { Feature, FeatureAttributes } from "../types";

/** Display text for an attribute, or "" when it is missing or a placeholder (-999, NOT AVAILABLE). */
export function displayValue(value: FeatureAttributes[string] | undefined): string {
  if (typeof value === "number") return value === -999 ? "" : value.toLocaleString();
  const text = (value ?? "").trim();
  return text === "NOT AVAILABLE" ? "" : text;
}

export function featureName(feature: Feature): string {
  return displayValue(feature.attributes.NAME) || "Unknown";
}

export function featureLocation({ attributes: a }: Feature): string {
  return [a.CITY, a.STATE ?? a.STATE_ABBR].map(displayValue).filter(Boolean).join(", ");
}
