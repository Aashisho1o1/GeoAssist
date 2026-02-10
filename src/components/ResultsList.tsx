import type { Feature, Dataset } from "../types";

interface ResultsListProps {
  features: Feature[];
  dataset: Dataset;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

function getSubtitle(feature: Feature, dataset: Dataset): string {
  const a = feature.attributes;
  const city = (a.CITY || "") as string;
  const state = (a.STATE || a.ST || "") as string;
  const parts: string[] = [];

  if (city) parts.push(city);
  if (state) parts.push(state);

  const location = parts.join(", ");
  const details: string[] = [];

  if (dataset.id === "hospitals") {
    if (a.BEDS) details.push(`${a.BEDS} beds`);
    if (a.TRAUMA && a.TRAUMA !== "NOT AVAILABLE") details.push(String(a.TRAUMA));
  } else if (dataset.id === "schools") {
    if (a.ENROLLMENT) details.push(`${(a.ENROLLMENT as number).toLocaleString()} students`);
    if (a.LEVEL_) details.push(String(a.LEVEL_));
  } else if (dataset.id === "cities") {
    if (a.POP_2010) details.push(`Pop: ${(a.POP_2010 as number).toLocaleString()}`);
    if (a.CAPITAL === "Y") details.push("Capital");
  }

  return [location, ...details].filter(Boolean).join(" | ");
}

export function ResultsList({
  features,
  dataset,
  selectedIndex,
  onSelect,
}: ResultsListProps) {
  if (features.length === 0) return null;

  return (
    <div
      style={{
        borderTop: "1px solid var(--calcite-color-border-3)",
        maxHeight: 220,
        overflowY: "auto",
      }}
    >
      <calcite-list
        selection-mode="single"
        aria-label={`${features.length} results found`}
      >
        {features.map((feature, i) => {
          const name = (feature.attributes.NAME ||
            feature.attributes.name ||
            "Unknown") as string;
          const subtitle = getSubtitle(feature, dataset);

          return (
            <calcite-list-item
              key={i}
              label={name}
              description={subtitle}
              selected={selectedIndex === i || undefined}
              onCalciteListItemSelect={() => onSelect(i)}
              aria-label={`${name}, ${subtitle}`}
            >
              <calcite-icon
                slot="content-start"
                icon={dataset.icon}
                scale="s"
                style={{ color: selectedIndex === i ? "#f1c40f" : dataset.color }}
              />
            </calcite-list-item>
          );
        })}
      </calcite-list>
    </div>
  );
}
