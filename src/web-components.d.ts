/* eslint-disable @typescript-eslint/no-explicit-any */

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
  [key: string]: any;
};

// React's jsx-runtime JSX namespace extends React.JSX, so augmenting "react" covers all three.
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
      "calcite-dialog": WCProps;
      "calcite-label": WCProps;
    }
  }
}

export {};
