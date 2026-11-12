import Anthropic from "@anthropic-ai/sdk";
import type { FieldInfo } from "geoassist-hazard-proximity/core";
import type { Dataset, LLMQueryResult } from "../types";
import { LLM_SYSTEM_PROMPT } from "../data/datasets";
import { describeSchema } from "./schemaPrompt";

const MODEL = "claude-haiku-5-5";
const MIN_RESULT_RECORD_COUNT = 1;
const DEFAULT_RESULT_RECORD_COUNT = 20;
const MAX_RESULT_RECORD_COUNT = 50;

// Structured outputs guarantee the response matches this shape.
const QUERY_SCHEMA = {
  type: "object",
  properties: {
    where: { type: "string" },
    outFields: { type: "string" },
    orderByFields: { type: "string" },
    resultRecordCount: { type: "integer" },
    summary: { type: "string" },
  },
  required: ["where", "outFields", "orderByFields", "resultRecordCount", "summary"],
  additionalProperties: false,
};

type RawQuery = Omit<LLMQueryResult, "orderByFields"> & { orderByFields: string };

export async function translateQuestion(
  apiKey: string,
  question: string,
  dataset: Dataset,
  schema: FieldInfo[],
  signal: AbortSignal
): Promise<LLMQueryResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 16000,
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: QUERY_SCHEMA },
        },
        system: LLM_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Dataset: ${dataset.name}\nFields:\n${describeSchema(schema)}\nNotes:\n- ${dataset.notes.join("\n- ")}\n\nUser question: "${question}"`,
          },
        ],
      },
      { signal }
    );
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error("Claude rejected the API key. Update it from the key icon.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error("Claude rate limit reached. Wait a moment and try again.");
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined this question. Try rephrasing.");
  }
  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Claude returned no query. Try rephrasing.");

  const raw = JSON.parse(text) as RawQuery;
  return {
    where: raw.where.trim() || "1=1",
    outFields: raw.outFields.trim() || "*",
    orderByFields: raw.orderByFields.trim() || undefined,
    resultRecordCount: Number.isInteger(raw.resultRecordCount)
      ? Math.min(MAX_RESULT_RECORD_COUNT, Math.max(MIN_RESULT_RECORD_COUNT, raw.resultRecordCount))
      : DEFAULT_RESULT_RECORD_COUNT,
    summary: raw.summary.trim(),
  };
}
