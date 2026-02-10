import { useState, useCallback } from "react";
import type { Dataset, LLMQueryResult } from "../types";
import { LLM_SYSTEM_PROMPT } from "../data/datasets";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface UseLLMTranslationReturn {
  translate: (question: string, dataset: Dataset) => Promise<LLMQueryResult>;
  loading: boolean;
  error: string | null;
}

export function useLLMTranslation(apiKey: string): UseLLMTranslationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translate = useCallback(
    async (question: string, dataset: Dataset): Promise<LLMQueryResult> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: LLM_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: `Dataset: ${dataset.name}\nAvailable key fields: ${dataset.keyFields}\nAll fields: ${dataset.fields.join(", ")}\n\nUser question: "${question}"`,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(
            errData?.error?.message || `API request failed (${response.status})`
          );
        }

        const data = await response.json();
        const text = data.content?.[0]?.text || "";

        const cleaned = text
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();

        const parsed: LLMQueryResult = JSON.parse(cleaned);
        return parsed;
      } catch (err) {
        const message =
          err instanceof SyntaxError
            ? "AI couldn't understand the question. Try rephrasing."
            : err instanceof Error
              ? err.message
              : "Unknown error occurred";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [apiKey]
  );

  return { translate, loading, error };
}
