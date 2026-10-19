import { useEffect, useState } from "react";
import "@arcgis/map-components/dist/components/arcgis-map";
import "@arcgis/map-components/dist/components/arcgis-search";
import "@arcgis/map-components/dist/components/arcgis-zoom";
import type { Feature, Dataset } from "../types";
import { showResults, highlightResult, clearResults } from "../lib/mapGraphics";

interface MapPanelProps {
  features: Feature[] | null;
  dataset: Dataset | null;
  selectedIndex: number | null;
  darkMode: boolean;
}

export function MapPanel({ features, dataset, selectedIndex, darkMode }: MapPanelProps) {
  const [view, setView] = useState<__esri.MapView | null>(null);

  useEffect(() => {
    if (!view) return;
    if (features?.length && dataset) showResults(view, features, dataset);
    else clearResults(view);
  }, [view, features, dataset]);

  useEffect(() => {
    const feature = selectedIndex === null ? undefined : features?.[selectedIndex];
    if (view && feature) highlightResult(view, feature);
  }, [view, features, selectedIndex]);

  return (
    <arcgis-map
      basemap={darkMode ? "dark-gray-vector" : "streets-vector"}
      center="-98.35,39.5"
      zoom={4}
      onarcgisViewReadyChange={(e: Event) => setView((e.target as HTMLArcgisMapElement).view)}
      style={{ width: "100%", height: "100%" }}
      aria-label="Interactive map showing query results"
    >
      <arcgis-search position="top-right" />
      <arcgis-zoom position="bottom-right" />
    </arcgis-map>
  );
}
