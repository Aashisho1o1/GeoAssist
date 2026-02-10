import { useRef, useEffect } from "react";
import type { ChatMessage } from "../types";

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
}

export function ChatPanel({ messages, loading }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) return null;

  return (
    <div
      className="chat-panel"
      role="log"
      aria-label="Conversation history"
      aria-live="polite"
      style={{ padding: "0.75rem", overflowY: "auto", flex: 1 }}
    >
      {messages.map((msg, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: "0.75rem",
          }}
        >
          <div
            style={{
              maxWidth: "85%",
              padding: "0.625rem 0.875rem",
              borderRadius:
                msg.role === "user"
                  ? "0.875rem 0.875rem 0.25rem 0.875rem"
                  : "0.875rem 0.875rem 0.875rem 0.25rem",
              background:
                msg.role === "user"
                  ? "var(--calcite-color-brand)"
                  : msg.isError
                    ? "var(--calcite-color-status-danger-muted)"
                    : "var(--calcite-color-foreground-2)",
              color:
                msg.role === "user"
                  ? "var(--calcite-color-text-inverse)"
                  : msg.isError
                    ? "var(--calcite-color-status-danger)"
                    : "var(--calcite-color-text-1)",
              fontSize: "0.8125rem",
              lineHeight: 1.5,
            }}
          >
            {msg.text}
            {msg.count !== undefined && msg.count > 0 && (
              <div
                style={{
                  marginTop: "0.375rem",
                  fontSize: "0.6875rem",
                  opacity: 0.8,
                }}
              >
                <calcite-icon icon="pin" scale="s" /> {msg.count} locations
                shown on map
              </div>
            )}
          </div>
        </div>
      ))}

      {loading && (
        <div style={{ padding: "0.75rem" }}>
          <calcite-loader scale="s" label="Analyzing question..." inline />
          <span
            style={{
              marginLeft: "0.5rem",
              fontSize: "0.8125rem",
              color: "var(--calcite-color-text-3)",
            }}
          >
            Analyzing your question...
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
