/* eslint-disable @typescript-eslint/no-explicit-any */

// ArcGIS Map Components element types
interface HTMLArcgisMapElement extends HTMLElement {
  view: __esri.MapView;
  map: __esri.Map | undefined | null;
  ready: boolean;
}

interface HTMLCalciteInputTextElement extends HTMLElement {
  value: string;
}

// Generic web component props base
type WCProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  [key: string]: any;
};

type ArcgisMapProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLArcgisMapElement>,
  HTMLArcgisMapElement
> & {
  basemap?: string;
  center?: string;
  zoom?: number;
  itemId?: string;
  "content-behind"?: boolean;
  [key: string]: any;
};

// Augment all three JSX namespaces for full React compatibility
declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      // ArcGIS Map Components
      "arcgis-map": ArcgisMapProps;
      "arcgis-search": WCProps;
      "arcgis-zoom": WCProps;
      // Calcite Components
      "calcite-shell": WCProps;
      "calcite-shell-panel": WCProps;
      "calcite-panel": WCProps;
      "calcite-navigation": WCProps;
      "calcite-navigation-logo": WCProps;
      "calcite-action": WCProps;
      "calcite-button": WCProps;
      "calcite-input-text": WCProps;
      "calcite-card": WCProps;
      "calcite-chip": WCProps;
      "calcite-icon": WCProps;
      "calcite-notice": WCProps;
      "calcite-list": WCProps;
      "calcite-list-item": WCProps;
      "calcite-loader": WCProps;
      "calcite-accordion": WCProps;
      "calcite-accordion-item": WCProps;
      "calcite-tooltip": WCProps;
      "calcite-dialog": WCProps;
      "calcite-label": WCProps;
    }
  }
}

declare module "react/jsx-dev-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "arcgis-map": ArcgisMapProps;
      "arcgis-search": WCProps;
      "arcgis-zoom": WCProps;
      "calcite-shell": WCProps;
      "calcite-shell-panel": WCProps;
      "calcite-panel": WCProps;
      "calcite-navigation": WCProps;
      "calcite-navigation-logo": WCProps;
      "calcite-action": WCProps;
      "calcite-button": WCProps;
      "calcite-input-text": WCProps;
      "calcite-card": WCProps;
      "calcite-chip": WCProps;
      "calcite-icon": WCProps;
      "calcite-notice": WCProps;
      "calcite-list": WCProps;
      "calcite-list-item": WCProps;
      "calcite-loader": WCProps;
      "calcite-accordion": WCProps;
      "calcite-accordion-item": WCProps;
      "calcite-tooltip": WCProps;
      "calcite-dialog": WCProps;
      "calcite-label": WCProps;
    }
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "arcgis-map": ArcgisMapProps;
      "arcgis-search": WCProps;
      "arcgis-zoom": WCProps;
      "calcite-shell": WCProps;
      "calcite-shell-panel": WCProps;
      "calcite-panel": WCProps;
      "calcite-navigation": WCProps;
      "calcite-navigation-logo": WCProps;
      "calcite-action": WCProps;
      "calcite-button": WCProps;
      "calcite-input-text": WCProps;
      "calcite-card": WCProps;
      "calcite-chip": WCProps;
      "calcite-icon": WCProps;
      "calcite-notice": WCProps;
      "calcite-list": WCProps;
      "calcite-list-item": WCProps;
      "calcite-loader": WCProps;
      "calcite-accordion": WCProps;
      "calcite-accordion-item": WCProps;
      "calcite-tooltip": WCProps;
      "calcite-dialog": WCProps;
      "calcite-label": WCProps;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "arcgis-map": HTMLArcgisMapElement;
    "calcite-input-text": HTMLCalciteInputTextElement;
  }
}

export {};
