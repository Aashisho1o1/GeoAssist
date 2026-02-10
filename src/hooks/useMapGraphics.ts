import { useCallback, useRef } from "react";
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
    dataset: Dataset,
    index: number
  ) => void;
  clearGraphics: (map: __esri.Map) => void;
}

const RESULTS_LAYER_ID = "geoassist-results";
const HIGHLIGHT_LAYER_ID = "geoassist-highlight";

function getCoordinates(feature: Feature): [number, number] | null {
  if (feature.geometry?.x && feature.geometry?.y) {
    const lat = feature.geometry.y;
    const lng = feature.geometry.x;
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return [lng, lat];
    }
  }
  const attrs = feature.attributes;
  if (attrs.LATITUDE && attrs.LONGITUDE) {
    return [attrs.LONGITUDE as number, attrs.LATITUDE as number];
  }
  return null;
}

function buildPopupContent(feature: Feature, _dataset: Dataset): string {
  const a = feature.attributes;
  const name = (a.NAME || a.name || "Unknown") as string;
  const city = (a.CITY || "") as string;
  const state = (a.STATE || a.ST || "") as string;

  let content = `<b>${name}</b><br/>${city}${state ? ", " + state : ""}`;

  if (a.BEDS) content += `<br/>Beds: <b>${a.BEDS}</b>`;
  if (a.TRAUMA && a.TRAUMA !== "NOT AVAILABLE")
    content += `<br/>Trauma: <b>${a.TRAUMA}</b>`;
  if (a.HELIPAD) content += `<br/>Helipad: <b>${a.HELIPAD}</b>`;
  if (a.OWNER) content += `<br/>Owner: <b>${a.OWNER}</b>`;
  if (a.TYPE) content += `<br/>Type: <b>${a.TYPE}</b>`;
  if (a.ENROLLMENT)
    content += `<br/>Students: <b>${(a.ENROLLMENT as number).toLocaleString()}</b>`;
  if (a.FT_TEACHER) content += `<br/>Teachers: <b>${a.FT_TEACHER}</b>`;
  if (a.LEVEL_) content += `<br/>Level: <b>${a.LEVEL_}</b>`;
  if (a.POP_2010)
    content += `<br/>Population: <b>${(a.POP_2010 as number).toLocaleString()}</b>`;
  if (a.MED_AGE) content += `<br/>Median Age: <b>${a.MED_AGE}</b>`;
  if (a.CAPITAL === "Y") content += `<br/><b>State Capital</b>`;
  if (a.TELEPHONE) content += `<br/>Phone: ${a.TELEPHONE}`;

  return content;
}

export function useMapGraphics(): UseMapGraphicsReturn {
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null);
  const highlightLayerRef = useRef<GraphicsLayer | null>(null);

  const getOrCreateLayer = useCallback(
    (map: __esri.Map, id: string, ref: React.RefObject<GraphicsLayer | null>): GraphicsLayer => {
      let layer = map.findLayerById(id) as GraphicsLayer | undefined;
      if (!layer) {
        layer = new GraphicsLayer({ id });
        map.add(layer);
      }
      ref.current = layer;
      return layer;
    },
    []
  );

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
      const layer = getOrCreateLayer(map, RESULTS_LAYER_ID, graphicsLayerRef);
      const highlightLayer = getOrCreateLayer(map, HIGHLIGHT_LAYER_ID, highlightLayerRef);
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

        const name = (feature.attributes.NAME || feature.attributes.name || "Unknown") as string;

        const graphic = new Graphic({
          geometry: point,
          symbol,
          attributes: { ...feature.attributes, _index: index },
          popupTemplate: new PopupTemplate({
            title: name,
            content: buildPopupContent(feature, dataset),
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
      dataset: Dataset,
      index: number
    ) => {
      const highlightLayer = getOrCreateLayer(map, HIGHLIGHT_LAYER_ID, highlightLayerRef);
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

      const name = (feature.attributes.NAME || feature.attributes.name || "Unknown") as string;

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
            content: buildPopupContent(feature, dataset),
          }),
        }),
        new Graphic({ geometry: point, symbol: labelSymbol }),
      ]);

      view.goTo({ target: point, zoom: Math.max(view.zoom, 8) }, { duration: 500 }).catch(() => {});
      view.openPopup({
        title: name,
        content: buildPopupContent(feature, dataset),
        location: point,
      });
    },
    [getOrCreateLayer]
  );

  return { displayResults, highlightResult, clearGraphics };
}
