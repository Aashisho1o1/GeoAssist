import type { Dataset } from "../types";
import { DATASETS } from "../data/datasets";

interface DatasetSelectorProps {
  onSelect: (dataset: Dataset) => void;
}

export function DatasetSelector({ onSelect }: DatasetSelectorProps) {
  return (
    <div className="dataset-selector">
      <div style={{ textAlign: "center", padding: "2rem 1rem 1rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
          What do you want to explore?
        </h2>
        <p
          style={{
            color: "var(--calcite-color-text-3)",
            fontSize: "0.875rem",
            margin: 0,
          }}
        >
          Choose a dataset, then ask questions in plain English.
          <br />
          No GIS experience needed.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          padding: "1rem",
          maxWidth: 500,
          margin: "0 auto",
        }}
      >
        {DATASETS.map((ds) => (
          <calcite-card
            key={ds.id}
            onClick={() => onSelect(ds)}
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            aria-label={`Explore ${ds.name}: ${ds.description}`}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(ds);
              }
            }}
          >
            <span slot="heading">
              <calcite-icon icon={ds.icon} scale="s" /> {ds.name}
            </span>
            <span slot="description">{ds.description}</span>
            <div style={{ padding: "0.25rem 0" }}>
              <calcite-chip
                scale="s"
                appearance="outline-fill"
                kind="brand"
                icon={ds.icon}
              >
                {ds.impact}
              </calcite-chip>
            </div>
          </calcite-card>
        ))}
      </div>

      <div
        style={{
          textAlign: "center",
          padding: "1.5rem 1rem",
          color: "var(--calcite-color-text-3)",
          fontSize: "0.75rem",
        }}
      >
        Built with React + TypeScript | ArcGIS REST API | Claude AI
        <br />
        All data is free and publicly available from ArcGIS Living Atlas
      </div>
    </div>
  );
}
