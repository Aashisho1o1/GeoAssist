import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import type { Dataset, Feature } from "../types";
import { displayValue, featureLocation, featureName } from "./format";

const RESULTS_LAYER_ID = "geoassist-results";
const HIGHLIGHT_LAYER_ID = "geoassist-highlight";

const POPUP_FIELDS: [field: string, label: string][] = [
  ["BEDS", "Beds"], ["TRAUMA", "Trauma"], ["HELIPAD", "Helipad"], ["OWNER", "Owner"],
  ["TYPE", "Type"], ["LEVEL_", "Level"], ["ENROLLMENT", "Students"], ["FT_TEACHER", "Teachers"],
  ["POPULATION", "Population"], ["CAPITAL", "Capital"], ["TELEPHONE", "Phone"],
];

function layer(view: __esri.MapView, id: string): GraphicsLayer {
  let found = view.map?.findLayerById(id) as GraphicsLayer | undefined;
  if (!found) {
    found = new GraphicsLayer({ id });
    view.map?.add(found);
  }
  return found;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function toPoint({ geometry, attributes }: Feature): Point | null {
  const longitude = geometry?.x ?? attributes.LONGITUDE;
  const latitude = geometry?.y ?? attributes.LATITUDE;
  return typeof longitude === "number" && typeof latitude === "number"
    ? new Point({ longitude, latitude })
    : null;
}

function popupContent(feature: Feature): string {
  const rows = POPUP_FIELDS.flatMap(([field, label]) => {
    const value = displayValue(feature.attributes[field]);
    return value ? [`${label}: <b>${escapeHtml(value)}</b>`] : [];
  });
  return [escapeHtml(featureLocation(feature)), ...rows].join("<br/>");
}

export function showResults(view: __esri.MapView, features: Feature[], dataset: Dataset): void {
  clearResults(view);
  const graphics = features.flatMap((feature) => {
    const point = toPoint(feature);
    if (!point) return [];
    return new Graphic({
      geometry: point,
      symbol: {
        type: "simple-marker",
        color: dataset.color,
        size: 10,
        outline: { color: "white", width: 1.5 },
      },
      attributes: feature.attributes,
      popupTemplate: { title: featureName(feature), content: popupContent(feature) },
    });
  });
  layer(view, RESULTS_LAYER_ID).addMany(graphics);
  if (graphics.length) view.goTo(graphics).catch(() => {});
}

export function highlightResult(view: __esri.MapView, feature: Feature): void {
  const highlight = layer(view, HIGHLIGHT_LAYER_ID);
  highlight.removeAll();
  const point = toPoint(feature);
  if (!point) return;

  const name = featureName(feature);
  highlight.addMany([
    new Graphic({
      geometry: point,
      symbol: {
        type: "simple-marker",
        color: "#f1c40f",
        size: 16,
        outline: { color: "white", width: 2.5 },
      },
    }),
    new Graphic({
      geometry: point,
      symbol: {
        type: "text",
        text: name,
        color: "white",
        haloColor: "black",
        haloSize: 1.5,
        font: { size: 11, weight: "bold" },
        yoffset: 16,
      },
    }),
  ]);
  view.goTo({ target: point, zoom: Math.max(view.zoom, 8) }, { duration: 500 }).catch(() => {});
  view.openPopup({ title: name, content: popupContent(feature), location: point });
}

export function clearResults(view: __esri.MapView): void {
  layer(view, RESULTS_LAYER_ID).removeAll();
  layer(view, HIGHLIGHT_LAYER_ID).removeAll();
}
