import { Suspense, lazy, useState, useCallback, useRef, useEffect } from "react";

import "@esri/calcite-components/dist/calcite/calcite.css";
import { setAssetPath } from "@esri/calcite-components";
setAssetPath(import.meta.env.BASE_URL + "assets");

import "@arcgis/core/assets/esri/themes/dark/main.css";
import esriConfig from "@arcgis/core/config";
esriConfig.assetsPath = import.meta.env.BASE_URL + "assets";

import "@esri/calcite-components/dist/components/calcite-shell";
import "@esri/calcite-components/dist/components/calcite-shell-panel";
import "@esri/calcite-components/dist/components/calcite-panel";
import "@esri/calcite-components/dist/components/calcite-navigation";
import "@esri/calcite-components/dist/components/calcite-navigation-logo";
import "@esri/calcite-components/dist/components/calcite-action";
import "@esri/calcite-components/dist/components/calcite-button";
import "@esri/calcite-components/dist/components/calcite-input-text";
import "@esri/calcite-components/dist/components/calcite-card";
import "@esri/calcite-components/dist/components/calcite-chip";
import "@esri/calcite-components/dist/components/calcite-icon";
import "@esri/calcite-components/dist/components/calcite-notice";
import "@esri/calcite-components/dist/components/calcite-list";
import "@esri/calcite-components/dist/components/calcite-list-item";
import "@esri/calcite-components/dist/components/calcite-loader";
import "@esri/calcite-components/dist/components/calcite-accordion";
import "@esri/calcite-components/dist/components/calcite-accordion-item";
import "@esri/calcite-components/dist/components/calcite-dialog";
import "@esri/calcite-components/dist/components/calcite-label";

import type { Dataset, Feature, ChatMessage, LLMQueryResult } from "./types";
import { DatasetSelector } from "./components/DatasetSelector";
import { ChatPanel } from "./components/ChatPanel";
import { ResultsList } from "./components/ResultsList";
import { QueryInspector } from "./components/QueryInspector";
import { ExampleQuestions } from "./components/ExampleQuestions";
import { translateQuestion } from "./lib/translate";
import { getSchema, getDataSource } from "geoassist-hazard-proximity/core";
import { queryFeatures } from "./lib/arcgis";
import { resultSummary } from "./lib/format";
import { prepareQuery } from "./lib/prepareQuery";

const MapPanel = lazy(() =>
  import("./components/MapPanel").then((module) => ({ default: module.MapPanel }))
);

// Earlier versions saved the key in localStorage under this name. The key
// now lives in memory only, so a copy left by an old version is deleted on
// load. Storage can be unavailable (private windows, blocked site data).
const OLD_STORAGE_KEY = "geoassist_api_key";
function forgetStoredKey(): void {
  try {
    localStorage.removeItem(OLD_STORAGE_KEY);
  } catch {
    // Nothing stored, or storage is blocked: either way nothing is kept.
  }
}

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [features, setFeatures] = useState<Feature[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentQuery, setCurrentQuery] = useState<LLMQueryResult | null>(null);
  const [queryText, setQueryText] = useState("");
  const [loading, setLoading] = useState(false);
  // The key in use. It lives in memory only and is gone on reload.
  const [apiKey, setApiKey] = useState("");
  // What is typed in the dialog. It becomes the key in use only on Save.
  const [draftKey, setDraftKey] = useState("");
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  // Data-edit date of the selected layer, read from the service. Keyed by
  // dataset id so a slow reply for one dataset never labels another.
  // `date` is null when the service reports none; `failed` when it could not be read.
  // The layer edit date per dataset. Kept by id, so a slow answer for a
  // dataset the person already left fills in only that dataset's line.
  const [editDates, setEditDates] = useState<Record<string, { date: string | null; failed?: boolean }>>({});
  const recordEditDate = useCallback((id: string, value: { date: string | null; failed?: boolean }) => {
    // A late failure never replaces a date that was already read.
    setEditDates((prev) => (value.failed && prev[id] && !prev[id].failed ? prev : { ...prev, [id]: value }));
  }, []);

  const liveRegionRef = useRef<HTMLDivElement | null>(null);
  // Set while a search is in flight; replaced or cleared to make that search stale.
  const searchRef = useRef<AbortController | null>(null);

  useEffect(forgetStoredKey, []);

  useEffect(() => {
    document.documentElement.classList.toggle("calcite-mode-dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!selectedDataset) return;
    const id = selectedDataset.id;
    getDataSource(selectedDataset.core)
      .then((source) => recordEditDate(id, { date: source.layer_last_edited }))
      .catch(() => recordEditDate(id, { date: null, failed: true }));
  }, [selectedDataset, recordEditDate]);

  const announceToScreenReader = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
    }
  }, []);

  const resetSession = useCallback((dataset: Dataset | null) => {
    searchRef.current?.abort();
    searchRef.current = null;
    setLoading(false);
    setSelectedDataset(dataset);
    setFeatures(null);
    setCurrentQuery(null);
    setChatHistory([]);
    setSelectedIndex(null);
    setQueryText("");
  }, []);

  const handleDatasetSelect = useCallback((dataset: Dataset) => {
    resetSession(dataset);
    announceToScreenReader(`Selected ${dataset.name} dataset. ${dataset.description}`);
  }, [resetSession, announceToScreenReader]);

  const handleBackToDatasets = useCallback(() => resetSession(null), [resetSession]);

  const openApiKeyDialog = useCallback(() => {
    setDraftKey(apiKey);
    setShowApiKeyDialog(true);
  }, [apiKey]);

  const handleSearch = useCallback(
    async (searchText?: string) => {
      const question = searchText || queryText;
      if (!question.trim() || !selectedDataset || searchRef.current) return;
      // Example questions always run their pre-translated query, with or
      // without a key, so a wrong key can't break them and they cost nothing.
      const example = selectedDataset.examples.find((e) => e.question === question);
      if (!apiKey && !example) {
        openApiKeyDialog();
        return;
      }

      const search = new AbortController();
      searchRef.current = search;
      const isStale = () => searchRef.current !== search;
      setLoading(true);
      setQueryText("");
      setSelectedIndex(null);
      // Clear the last answer now, so a failed or rejected search never
      // leaves the previous question's results on the map and in the list.
      setFeatures(null);
      setCurrentQuery(null);

      setChatHistory((prev) => [...prev, { role: "user", text: question }]);
      announceToScreenReader(`Searching: ${question}`);

      try {
        // Fields, types and real values, read from the live layer (cached for an hour).
        const schema = await getSchema(selectedDataset.core);
        if (isStale()) return;
        // Reading the schema also reads the layer's edit date, so fill it in
        // here in case the first attempt failed.
        getDataSource(selectedDataset.core)
          .then((source) => recordEditDate(selectedDataset.id, { date: source.layer_last_edited }))
          .catch(() => {});

        const generated =
          example?.query ?? (await translateQuestion(apiKey, question, selectedDataset, schema, search.signal));
        if (isStale()) return;
        // Show what was generated even if the check below refuses it.
        setCurrentQuery(generated);

        // The same gate geoassist-mcp uses. Throws before anything reaches ArcGIS.
        const { query: queryParams, openOnlyApplied, warnings } = prepareQuery(selectedDataset, schema, generated);
        setCurrentQuery(queryParams);

        const { features: results, total } = await queryFeatures(selectedDataset, queryParams, search.signal);
        if (isStale()) return;
        setFeatures(results);

        const summary = example ? `${queryParams.summary} (Pre-translated example.)` : queryParams.summary;
        const counts = resultSummary(results.length, total);
        const notes = [
          ...(openOnlyApplied ? ["Only hospitals marked open in this snapshot are included."] : []),
          ...warnings,
        ];

        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", text: [summary, counts, ...notes].join(" "), count: results.length },
        ]);

        announceToScreenReader(`${counts} ${queryParams.summary}`);
      } catch (err) {
        if (isStale()) return;
        const message = err instanceof Error ? err.message : "An error occurred";
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", text: `Error: ${message}`, isError: true },
        ]);
        announceToScreenReader(`Error: ${message}`);
      } finally {
        if (!isStale()) {
          searchRef.current = null;
          setLoading(false);
        }
      }
    },
    [queryText, selectedDataset, apiKey, announceToScreenReader, openApiKeyDialog, recordEditDate]
  );

  const handleApiKeySave = useCallback(() => {
    setApiKey(draftKey.trim());
    setShowApiKeyDialog(false);
  }, [draftKey]);

  const handleApiKeyRemove = useCallback(() => {
    setApiKey("");
    setDraftKey("");
    setShowApiKeyDialog(false);
  }, []);

  return (
    <>
      {/* Screen reader live region */}
      <div ref={liveRegionRef} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />

      {/* API Key Dialog */}
      <calcite-dialog
        heading="Enter Claude API Key"
        open={showApiKeyDialog || undefined}
        oncalciteDialogClose={() => setShowApiKeyDialog(false)}
        modal
      >
        <div style={{ padding: "1rem" }}>
          <calcite-notice open icon="information" scale="s" kind="info">
            <div slot="message">
              The example questions work without a key. To ask your own, add a Claude
              API key. It is sent only to Anthropic&apos;s API, straight from this page. It is
              kept in memory only, never saved, and forgotten when you close or reload the tab.
            </div>
          </calcite-notice>
          <div style={{ marginTop: "1rem" }}>
            <calcite-label>
              Claude API Key
              <calcite-input-text
                type="password"
                placeholder="sk-ant-..."
                value={draftKey}
                oncalciteInputTextInput={(e: Event) => {
                  const target = e.target as HTMLCalciteInputTextElement;
                  setDraftKey(target.value);
                }}
              />
            </calcite-label>
          </div>
        </div>
        {apiKey && (
          <calcite-button slot="footer-start" kind="danger" appearance="outline" onClick={handleApiKeyRemove}>
            Remove key
          </calcite-button>
        )}
        <calcite-button
          slot="footer-end"
          onClick={handleApiKeySave}
          disabled={!draftKey.trim() || undefined}
        >
          Save
        </calcite-button>
      </calcite-dialog>

      <calcite-shell content-behind>
        {/* Navigation Header */}
        <calcite-navigation slot="header">
          <calcite-navigation-logo
            slot="logo"
            heading="GeoAssist"
            description="Plain-English questions for public ArcGIS layers"
            icon="globe"
          />
          <div slot="content-end" style={{ display: "flex", gap: "0.25rem" }}>
            <calcite-action
              text="API Key"
              icon="key"
              onClick={openApiKeyDialog}
              aria-label="Configure API key"
            />
            <calcite-action
              text={darkMode ? "Light mode" : "Dark mode"}
              icon={darkMode ? "brightness" : "moon"}
              onClick={() => setDarkMode(!darkMode)}
              aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
            />
          </div>
        </calcite-navigation>

        {/* Sidebar Panel */}
        <calcite-shell-panel
          slot="panel-start"
          position="start"
          resizable
          style={{ "--calcite-shell-panel-width": selectedDataset ? "380px" : "100%" } as React.CSSProperties}
        >
          <calcite-panel
            heading={selectedDataset ? selectedDataset.name : "Explore"}
            description={selectedDataset?.description}
          >
            {selectedDataset && (
              <calcite-action
                slot="header-actions-start"
                icon="arrow-left"
                text="Back"
                onClick={handleBackToDatasets}
                aria-label="Back to dataset selection"
              />
            )}

            {!selectedDataset ? (
              <DatasetSelector onSelect={handleDatasetSelect} />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  overflow: "hidden",
                }}
              >
                {/* Example questions when no chat history */}
                {chatHistory.length === 0 && (
                  <ExampleQuestions
                    dataset={selectedDataset}
                    onSelect={(q) => handleSearch(q)}
                  />
                )}

                {/* Chat history */}
                <ChatPanel messages={chatHistory} loading={loading} />

                {/* Query Inspector */}
                <QueryInspector query={currentQuery} />

                {/* Results List */}
                {features && (
                  <ResultsList
                    features={features}
                    dataset={selectedDataset}
                    selectedIndex={selectedIndex}
                    onSelect={setSelectedIndex}
                  />
                )}

                {/* Where the data comes from and how old it is */}
                <p className="data-source">
                  Source:{" "}
                  <a href={selectedDataset.core.source.item_url} target="_blank" rel="noopener noreferrer">
                    {selectedDataset.core.source.origin}
                  </a>
                  , hosted by {selectedDataset.core.source.hosted_by}.{" "}
                  {!editDates[selectedDataset.id]
                    ? "Reading the layer's edit date."
                    : editDates[selectedDataset.id].date
                      ? `Data last edited ${editDates[selectedDataset.id].date}.`
                      : editDates[selectedDataset.id].failed
                        ? "The layer's edit date could not be read."
                        : "The layer does not report an edit date."}{" "}
                  A public snapshot, not a live feed.
                </p>

                {/* Input area */}
                <div
                  style={{
                    padding: "0.75rem",
                    borderTop: "1px solid var(--calcite-color-border-3)",
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <calcite-input-text
                    placeholder={`Ask about ${selectedDataset.label}...`}
                    value={queryText}
                    disabled={loading || undefined}
                    oncalciteInputTextInput={(e: Event) => {
                      const target = e.target as HTMLCalciteInputTextElement;
                      setQueryText(target.value);
                    }}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    style={{ flex: 1 }}
                    aria-label={`Ask a question about ${selectedDataset.name}`}
                  />
                  <calcite-button
                    iconStart="search"
                    onClick={() => handleSearch()}
                    disabled={loading || !queryText.trim() || undefined}
                    loading={loading || undefined}
                    aria-label="Search"
                    scale="m"
                  >
                    Ask
                  </calcite-button>
                </div>
              </div>
            )}
          </calcite-panel>
        </calcite-shell-panel>

        {/* Map */}
        <Suspense
          fallback={
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
                background: "var(--calcite-color-foreground-1)",
              }}
            >
              <calcite-loader label="Loading map..." />
            </div>
          }
        >
          <MapPanel
            features={features}
            dataset={selectedDataset}
            selectedIndex={selectedIndex}
            darkMode={darkMode}
          />
        </Suspense>
      </calcite-shell>
    </>
  );
}

export default App;
