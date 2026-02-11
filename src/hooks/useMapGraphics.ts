import { useCallback } from "react";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import type { Feature, Dataset } from "../types";

interface UseMapGraphicsReturn {
  displayResults: (
    view: __esri.MapView,
    map: __esri.Map,
    features: Feature[],
    dataset: Dataset
  ) => void;
  highlightResult: (
    view: __esri.MapView,
    map: __esri.Map,
    features: Feature[],
    index: number
  ) => void;
  clearGraphics: (map: __esri.Map) => void;
}

const RESULTS_LAYER_ID = "geoassist-results";
const HIGHLIGHT_LAYER_ID = "geoassist-highlight";

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatNumericValue(value: unknown): string | null {
  const parsed = toFiniteNumber(value);
  return parsed === null ? null : parsed.toLocaleString();
}

function getFeatureName(feature: Feature): string {
  const name = feature.attributes.NAME ?? feature.attributes.name;
  return toStringValue(name).trim() || "Unknown";
}

function getCoordinates(feature: Feature): [number, number] | null {
  if (feature.geometry) {
    const lat = toFiniteNumber(feature.geometry.y);
    const lng = toFiniteNumber(feature.geometry.x);
    if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return [lng, lat];
    }
  }

  const attrs = feature.attributes;
  const lat = toFiniteNumber(attrs.LATITUDE);
  const lng = toFiniteNumber(attrs.LONGITUDE);
  if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return [lng, lat];
  }

  return null;
}

function buildPopupContent(feature: Feature): string {
  const a = feature.attributes;
  const name = escapeHtml(getFeatureName(feature));
  const city = escapeHtml(toStringValue(a.CITY).trim());
  const state = escapeHtml(toStringValue(a.STATE ?? a.ST).trim());
  const trauma = toStringValue(a.TRAUMA).trim();
  const helipad = toStringValue(a.HELIPAD).trim();
  const owner = toStringValue(a.OWNER).trim();
  const type = toStringValue(a.TYPE).trim();
  const level = toStringValue(a.LEVEL_).trim();
  const phone = toStringValue(a.TELEPHONE).trim();
  const beds = formatNumericValue(a.BEDS);
  const enrollment = formatNumericValue(a.ENROLLMENT);
  const teachers = formatNumericValue(a.FT_TEACHER);
  const population = formatNumericValue(a.POP_2010);
  const medianAge = formatNumericValue(a.MED_AGE);

  let content = `<b>${name}</b><br/>${city}${state ? ", " + state : ""}`;

  if (beds) content += `<br/>Beds: <b>${escapeHtml(beds)}</b>`;
  if (trauma && trauma !== "NOT AVAILABLE") {
    content += `<br/>Trauma: <b>${escapeHtml(trauma)}</b>`;
  }
  if (helipad) content += `<br/>Helipad: <b>${escapeHtml(helipad)}</b>`;
  if (owner) content += `<br/>Owner: <b>${escapeHtml(owner)}</b>`;
  if (type) content += `<br/>Type: <b>${escapeHtml(type)}</b>`;
  if (enrollment) content += `<br/>Students: <b>${escapeHtml(enrollment)}</b>`;
  if (teachers) content += `<br/>Teachers: <b>${escapeHtml(teachers)}</b>`;
  if (level) content += `<br/>Level: <b>${escapeHtml(level)}</b>`;
  if (population) content += `<br/>Population: <b>${escapeHtml(population)}</b>`;
  if (medianAge) content += `<br/>Median Age: <b>${escapeHtml(medianAge)}</b>`;
  if (a.CAPITAL === "Y") content += `<br/><b>State Capital</b>`;
  if (phone) content += `<br/>Phone: ${escapeHtml(phone)}`;

  return content;
}

export function useMapGraphics(): UseMapGraphicsReturn {
  const getOrCreateLayer = useCallback((map: __esri.Map, id: string): GraphicsLayer => {
    let layer = map.findLayerById(id) as GraphicsLayer | undefined;
    if (!layer) {
      layer = new GraphicsLayer({ id });
      map.add(layer);
    }
    return layer;
  }, []);

  const clearGraphics = useCallback(
    (map: __esri.Map) => {
      const resultsLayer = map.findLayerById(RESULTS_LAYER_ID) as GraphicsLayer | undefined;
      const highlightLayer = map.findLayerById(HIGHLIGHT_LAYER_ID) as GraphicsLayer | undefined;
      resultsLayer?.removeAll();
      highlightLayer?.removeAll();
    },
    []
  );

  const displayResults = useCallback(
    (
      view: __esri.MapView,
      map: __esri.Map,
      features: Feature[],
      dataset: Dataset
    ) => {
      const layer = getOrCreateLayer(map, RESULTS_LAYER_ID);
      const highlightLayer = getOrCreateLayer(map, HIGHLIGHT_LAYER_ID);
      layer.removeAll();
      highlightLayer.removeAll();

      const graphics: Graphic[] = [];

      features.forEach((feature, index) => {
        const coords = getCoordinates(feature);
        if (!coords) return;

        const point = new Point({
          longitude: coords[0],
          latitude: coords[1],
        });

        const symbol = new SimpleMarkerSymbol({
          color: dataset.color,
          size: 10,
          outline: { color: "white", width: 1.5 },
        });

        const name = getFeatureName(feature);
        const popupContent = buildPopupContent(feature);

        const graphic = new Graphic({
          geometry: point,
          symbol,
          attributes: { ...feature.attributes, _index: index },
          popupTemplate: new PopupTemplate({
            title: name,
            content: popupContent,
          }),
        });

        graphics.push(graphic);
      });

      layer.addMany(graphics);

      if (graphics.length > 0) {
        view.goTo(graphics).catch(() => {
          // ignore animation errors
        });
      }
    },
    [getOrCreateLayer]
  );

  const highlightResult = useCallback(
    (
      view: __esri.MapView,
      map: __esri.Map,
      features: Feature[],
      index: number
    ) => {
      const highlightLayer = getOrCreateLayer(map, HIGHLIGHT_LAYER_ID);
      highlightLayer.removeAll();

      const feature = features[index];
      if (!feature) return;

      const coords = getCoordinates(feature);
      if (!coords) return;

      const point = new Point({
        longitude: coords[0],
        latitude: coords[1],
      });

      const highlightSymbol = new SimpleMarkerSymbol({
        color: "#f1c40f",
        size: 16,
        outline: { color: "white", width: 2.5 },
      });

      const name = getFeatureName(feature);
      const popupContent = buildPopupContent(feature);

      const labelSymbol = new TextSymbol({
        text: name,
        color: "white",
        haloColor: "black",
        haloSize: 1.5,
        font: { size: 11, weight: "bold" },
        yoffset: 16,
      });

      highlightLayer.addMany([
        new Graphic({
          geometry: point,
          symbol: highlightSymbol,
          attributes: feature.attributes,
          popupTemplate: new PopupTemplate({
            title: name,
            content: popupContent,
          }),
        }),
        new Graphic({ geometry: point, symbol: labelSymbol }),
      ]);

      view.goTo({ target: point, zoom: Math.max(view.zoom, 8) }, { duration: 500 }).catch(() => {});
      view.openPopup({
        title: name,
        content: popupContent,
        location: point,
      });
    },
    [getOrCreateLayer]
  );

  return { displayResults, highlightResult, clearGraphics };
}
