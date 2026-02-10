import type { Dataset } from "../types";

interface ExampleQuestionsProps {
  dataset: Dataset;
  onSelect: (question: string) => void;
}

export function ExampleQuestions({ dataset, onSelect }: ExampleQuestionsProps) {
  return (
    <div style={{ padding: "0.5rem" }}>
      <p
        style={{
          fontSize: "0.8125rem",
          color: "var(--calcite-color-text-3)",
          margin: "0 0 0.75rem",
        }}
      >
        Try asking:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {dataset.exampleQuestions.map((question, i) => (
          <calcite-button
            key={i}
            appearance="outline"
            kind="neutral"
            width="full"
            alignment="start"
            iconStart="speech-bubble"
            scale="s"
            onClick={() => onSelect(question)}
            aria-label={`Ask: ${question}`}
          >
            {question}
          </calcite-button>
        ))}
      </div>
    </div>
  );
}
