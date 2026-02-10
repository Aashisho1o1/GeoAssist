import type { LLMQueryResult } from "../types";

interface QueryInspectorProps {
  query: LLMQueryResult | null;
}

export function QueryInspector({ query }: QueryInspectorProps) {
  if (!query) return null;

  return (
    <div style={{ borderTop: "1px solid var(--calcite-color-border-3)" }}>
      <calcite-accordion scale="s">
        <calcite-accordion-item
          heading="View generated ArcGIS REST query"
          icon-start="code"
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "0.6875rem",
              lineHeight: 1.6,
              wordBreak: "break-all",
              padding: "0.5rem",
              background: "var(--calcite-color-foreground-2)",
              borderRadius: "0.25rem",
            }}
          >
            <div>
              <strong>WHERE:</strong> {query.where}
            </div>
            <div>
              <strong>FIELDS:</strong> {query.outFields}
            </div>
            {query.orderByFields && (
              <div>
                <strong>ORDER:</strong> {query.orderByFields}
              </div>
            )}
            <div>
              <strong>LIMIT:</strong> {query.resultRecordCount}
            </div>
          </div>
        </calcite-accordion-item>
      </calcite-accordion>
    </div>
  );
}
