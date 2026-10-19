import type { Feature, Dataset, FeatureAttributes } from "../types";
import { displayValue, featureLocation, featureName } from "../lib/format";

interface ResultsListProps {
  features: Feature[];
  dataset: Dataset;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

function withUnit(value: FeatureAttributes[string] | undefined, unit: string): string {
  const text = displayValue(value);
  return text && `${text} ${unit}`;
}

function getSubtitle(feature: Feature, dataset: Dataset): string {
  const a = feature.attributes;
  const details =
    dataset.id === "hospitals" ? [withUnit(a.BEDS, "beds"), displayValue(a.TRAUMA)]
    : dataset.id === "schools" ? [withUnit(a.ENROLLMENT, "students"), displayValue(a.LEVEL_)]
    : [withUnit(a.POPULATION, "people"), a.CAPITAL ? `${a.CAPITAL} capital` : ""];
  return [featureLocation(feature), ...details].filter(Boolean).join(" | ");
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
          const name = featureName(feature);
          const subtitle = getSubtitle(feature, dataset);

          return (
            <calcite-list-item
              key={i}
              label={name}
              description={subtitle}
              selected={selectedIndex === i || undefined}
              oncalciteListItemSelect={() => onSelect(i)}
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
