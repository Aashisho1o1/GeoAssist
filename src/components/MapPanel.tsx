import { useRef, useEffect, useCallback } from "react";
import "@arcgis/map-components/dist/components/arcgis-map";
import "@arcgis/map-components/dist/components/arcgis-search";
import "@arcgis/map-components/dist/components/arcgis-zoom";
import type { Feature, Dataset } from "../types";
import { useMapGraphics } from "../hooks/useMapGraphics";

interface MapPanelProps {
  features: Feature[] | null;
  dataset: Dataset | null;
  selectedIndex: number | null;
  darkMode: boolean;
}

export function MapPanel({
  features,
  dataset,
  selectedIndex,
  darkMode,
}: MapPanelProps) {
  const mapRef = useRef<HTMLArcgisMapElement>(null);
  const viewRef = useRef<__esri.MapView | null>(null);
  const mapObjRef = useRef<__esri.Map | null>(null);
  const { displayResults, highlightResult, clearGraphics } = useMapGraphics();

  const handleViewReady = useCallback((event: Event) => {
    const el = event.target as HTMLArcgisMapElement;
    if (el.view && el.map) {
      viewRef.current = el.view as __esri.MapView;
      mapObjRef.current = el.map as __esri.Map;
    }
  }, []);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;

    el.addEventListener("arcgisViewReadyChange", handleViewReady);
    return () => {
      el.removeEventListener("arcgisViewReadyChange", handleViewReady);
    };
  }, [handleViewReady]);

  useEffect(() => {
    const view = viewRef.current;
    const map = mapObjRef.current;
    if (!view || !map) return;

    if (features && features.length > 0 && dataset) {
      displayResults(view, map, features, dataset);
    } else {
      clearGraphics(map);
    }
  }, [features, dataset, displayResults, clearGraphics]);

  useEffect(() => {
    const view = viewRef.current;
    const map = mapObjRef.current;
    if (!view || !map || !features || selectedIndex === null) return;

    highlightResult(view, map, features, selectedIndex);
  }, [selectedIndex, features, highlightResult]);

  const basemap = darkMode ? "dark-gray-vector" : "streets-vector";

  return (
    <arcgis-map
      ref={mapRef}
      basemap={basemap}
      center="-98.35,39.5"
      zoom={4}
      style={{ width: "100%", height: "100%" }}
      aria-label="Interactive map showing query results"
    >
      <arcgis-search position="top-right" />
      <arcgis-zoom position="bottom-right" />
    </arcgis-map>
  );
}
