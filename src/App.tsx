import { useState, useCallback, useRef, useEffect } from "react";

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
import "@esri/calcite-components/dist/components/calcite-tooltip";
import "@esri/calcite-components/dist/components/calcite-dialog";
import "@esri/calcite-components/dist/components/calcite-label";

import type { Dataset, Feature, ChatMessage, LLMQueryResult } from "./types";
import { DatasetSelector } from "./components/DatasetSelector";
import { ChatPanel } from "./components/ChatPanel";
import { MapPanel } from "./components/MapPanel";
import { ResultsList } from "./components/ResultsList";
import { QueryInspector } from "./components/QueryInspector";
import { ExampleQuestions } from "./components/ExampleQuestions";
import { useLLMTranslation } from "./hooks/useLLMTranslation";
import { useArcGISQuery } from "./hooks/useArcGISQuery";

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [features, setFeatures] = useState<Feature[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentQuery, setCurrentQuery] = useState<LLMQueryResult | null>(null);
  const [queryText, setQueryText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("geoassist_api_key") || "");
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  const viewRef = useRef<__esri.MapView | null>(null);
  const mapObjRef = useRef<__esri.Map | null>(null);
  const inputRef = useRef<HTMLCalciteInputTextElement | null>(null);
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  const { translate, loading: llmLoading } = useLLMTranslation(apiKey);
  const { executeQuery, loading: queryLoading } = useArcGISQuery();

  const loading = llmLoading || queryLoading || isProcessing;

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("calcite-mode-dark");
    } else {
      document.documentElement.classList.remove("calcite-mode-dark");
    }
  }, [darkMode]);

  useEffect(() => {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setDarkMode(true);
    }
  }, []);

  const announceToScreenReader = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
    }
  }, []);

  const handleViewReady = useCallback((view: __esri.MapView, map: __esri.Map) => {
    viewRef.current = view;
    mapObjRef.current = map;
  }, []);

  const handleDatasetSelect = useCallback((dataset: Dataset) => {
    setSelectedDataset(dataset);
    setFeatures(null);
    setCurrentQuery(null);
    setChatHistory([]);
    setSelectedIndex(null);
    setQueryText("");
    announceToScreenReader(`Selected ${dataset.name} dataset. ${dataset.description}`);
  }, [announceToScreenReader]);

  const handleBackToDatasets = useCallback(() => {
    setSelectedDataset(null);
    setFeatures(null);
    setCurrentQuery(null);
    setChatHistory([]);
    setSelectedIndex(null);
  }, []);

  const handleSearch = useCallback(
    async (searchText?: string) => {
      const question = searchText || queryText;
      if (!question.trim() || !selectedDataset) return;
      if (!apiKey) {
        setShowApiKeyDialog(true);
        return;
      }

      setIsProcessing(true);
      setQueryText("");
      setSelectedIndex(null);

      setChatHistory((prev) => [...prev, { role: "user", text: question }]);
      announceToScreenReader(`Searching: ${question}`);

      try {
        const queryParams = await translate(question, selectedDataset);
        setCurrentQuery(queryParams);

        const results = await executeQuery(selectedDataset, queryParams);
        setFeatures(results);

        const summaryText =
          results.length > 0
            ? `${queryParams.summary} — Found ${results.length} result${results.length !== 1 ? "s" : ""}.`
            : `${queryParams.summary} — No results found. Try broadening your search.`;

        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", text: summaryText, count: results.length, query: queryParams },
        ]);

        announceToScreenReader(
          results.length > 0
            ? `Found ${results.length} results. ${queryParams.summary}`
            : "No results found. Try a different question."
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", text: `Error: ${message}`, isError: true },
        ]);
        announceToScreenReader(`Error: ${message}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [queryText, selectedDataset, apiKey, translate, executeQuery, announceToScreenReader]
  );

  const handleResultSelect = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleApiKeySave = useCallback(() => {
    localStorage.setItem("geoassist_api_key", apiKey);
    setShowApiKeyDialog(false);
  }, [apiKey]);

  return (
    <>
      {/* Screen reader live region */}
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          borderWidth: 0,
        }}
      />

      {/* API Key Dialog */}
      <calcite-dialog
        heading="Enter Claude API Key"
        open={showApiKeyDialog || undefined}
        onCalciteDialogClose={() => setShowApiKeyDialog(false)}
        modal
      >
        <div style={{ padding: "1rem" }}>
          <calcite-notice open icon="information" scale="s" kind="info">
            <div slot="message">
              Your API key is stored locally in your browser and never sent to any
              server except Anthropic&apos;s API directly.
            </div>
          </calcite-notice>
          <div style={{ marginTop: "1rem" }}>
            <calcite-label>
              Claude API Key
              <calcite-input-text
                type="password"
                placeholder="sk-ant-..."
                value={apiKey}
                onCalciteInputTextInput={(e: Event) => {
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
                    onSelect={handleResultSelect}
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
                    ref={inputRef}
                    placeholder={`Ask about ${selectedDataset.label}...`}
                    value={queryText}
                    disabled={loading || undefined}
                    onCalciteInputTextInput={(e: Event) => {
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
        <MapPanel
          features={features}
          dataset={selectedDataset}
          selectedIndex={selectedIndex}
          darkMode={darkMode}
          onViewReady={handleViewReady}
        />
      </calcite-shell>
    </>
  );
}

export default App;
