import { test } from "node:test";
import assert from "node:assert/strict";
import { readQuery } from "../src/lib/translate.ts";

const reply = (text: string, stop_reason: "end_turn" | "max_tokens" | "refusal" = "end_turn") =>
  ({ stop_reason, content: [{ type: "text", text, citations: null }] }) as Parameters<typeof readQuery>[0];
const full = JSON.stringify({ where: " STATE='CA' ", outFields: "", orderByFields: "", resultRecordCount: 500, summary: " Hospitals in CA. " });

test("a complete reply becomes a query, with blanks filled and the row count kept in range", () => {
  assert.deepEqual(readQuery(reply(full)), {
    where: "STATE='CA'",
    outFields: "*",
    orderByFields: undefined,
    resultRecordCount: 50,
    summary: "Hospitals in CA.",
  });
});

test("a reply cut off at max_tokens gives a message, not a JSON error", () => {
  // Structured output can stop mid-JSON when the token limit is reached.
  assert.throws(() => readQuery(reply(full.slice(0, 30), "max_tokens")), /^Error: Claude's answer was cut off before the query was complete/);
});

test("a reply that is not valid JSON gives a message, not a SyntaxError", () => {
  assert.throws(() => readQuery(reply(full.slice(0, 30))), (e: Error) => e.constructor === Error && /could not be read/.test(e.message));
});

test("a refusal or an empty reply says what to do next", () => {
  assert.throws(() => readQuery(reply("", "refusal")), /declined this question/);
  assert.throws(() => readQuery({ stop_reason: "end_turn", content: [] }), /returned no query/);
});
