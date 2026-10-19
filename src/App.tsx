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
import { queryFeatures } from "./lib/arcgis";
import { validateQuery } from "./lib/validateQuery";

const MapPanel = lazy(() =>
  import("./components/MapPanel").then((module) => ({ default: module.MapPanel }))
);

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [features, setFeatures] = useState<Feature[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentQuery, setCurrentQuery] = useState<LLMQueryResult | null>(null);
  const [queryText, setQueryText] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("geoassist_api_key") || "");
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  const liveRegionRef = useRef<HTMLDivElement | null>(null);
  // Set while a search is in flight; replaced or cleared to make that search stale.
  const searchRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("calcite-mode-dark", darkMode);
  }, [darkMode]);

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

  const handleSearch = useCallback(
    async (searchText?: string) => {
      const question = searchText || queryText;
      if (!question.trim() || !selectedDataset || searchRef.current) return;
      // Without a key, only the pre-translated examples can run.
      const example = apiKey ? undefined : selectedDataset.examples.find((e) => e.question === question);
      if (!apiKey && !example) {
        setShowApiKeyDialog(true);
        return;
      }

      const search = new AbortController();
      searchRef.current = search;
      const isStale = () => searchRef.current !== search;
      setLoading(true);
      setQueryText("");
      setSelectedIndex(null);

      setChatHistory((prev) => [...prev, { role: "user", text: question }]);
      announceToScreenReader(`Searching: ${question}`);

      try {
        const queryParams =
          example?.query ?? (await translateQuestion(apiKey, question, selectedDataset, search.signal));
        if (isStale()) return;
        setCurrentQuery(queryParams);
        validateQuery(queryParams, selectedDataset.fields);

        const results = await queryFeatures(selectedDataset, queryParams, search.signal);
        if (isStale()) return;
        setFeatures(results);

        const summary = example ? `${queryParams.summary} (Pre-translated example.)` : queryParams.summary;
        const summaryText =
          results.length > 0
            ? `${summary} — Found ${results.length} result${results.length !== 1 ? "s" : ""}.`
            : `${summary} — No results found. Try broadening your search.`;

        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", text: summaryText, count: results.length },
        ]);

        announceToScreenReader(
          results.length > 0
            ? `Found ${results.length} results. ${queryParams.summary}`
            : "No results found. Try a different question."
        );
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
    [queryText, selectedDataset, apiKey, announceToScreenReader]
  );

  const handleApiKeySave = useCallback(() => {
    localStorage.setItem("geoassist_api_key", apiKey);
    setShowApiKeyDialog(false);
  }, [apiKey]);

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
              API key. It is stored in your browser and sent only to Anthropic&apos;s API.
            </div>
          </calcite-notice>
          <div style={{ marginTop: "1rem" }}>
            <calcite-label>
              Claude API Key
              <calcite-input-text
                type="password"
                placeholder="sk-ant-..."
                value={apiKey}
                oncalciteInputTextInput={(e: Event) => {
                  const target = e.target as HTMLCalciteInputTextElement;
                  setApiKey(target.value);
                }}
              />
            </calcite-label>
          </div>
        </div>
        <calcite-button
          slot="footer-end"
          onClick={handleApiKeySave}
          disabled={!apiKey || undefined}
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
            description="Ask any map a question"
            icon="globe"
          />
          <div slot="content-end" style={{ display: "flex", gap: "0.25rem" }}>
            <calcite-action
              text="API Key"
              icon="key"
              onClick={() => setShowApiKeyDialog(true)}
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
