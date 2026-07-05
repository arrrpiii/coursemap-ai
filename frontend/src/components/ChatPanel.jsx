import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearChat,
  getChatHistory,
  sendChatMessage,
} from "../api/aiApi.js";
import { ErrorState, LoadingState } from "./LoadingState.jsx";
import renderMarkdown from "../utils/markdown.jsx";

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (_) {
    return "";
  }
}

export default function ChatPanel({ courseId, nodeId, nodeTitle }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [clearing, setClearing] = useState(false);

  const listRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getChatHistory(courseId, nodeId);
      setMessages(data && data.messages ? data.messages : []);
    } catch (err) {
      setError(err.message || "Failed to load chat history");
    } finally {
      setLoading(false);
    }
  }, [courseId, nodeId]);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    setSendError("");
    load();
  }, [load]);

  // Auto-scroll to the latest message whenever the list grows.
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  async function handleSend(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setDraft("");
    setSendError("");
    // Optimistic user message
    const optimisticUser = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);

    try {
      const res = await sendChatMessage(courseId, nodeId, text);
      const assistant = res?.message;
      if (assistant) {
        setMessages((prev) => [...prev, assistant]);
      } else {
        // Fallback: refetch authoritative history
        await load();
      }
    } catch (err) {
      setSendError(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    if (clearing) return;
    if (!window.confirm("Clear this chat history? This cannot be undone.")) return;
    setClearing(true);
    try {
      await clearChat(courseId, nodeId);
      setMessages([]);
    } catch (err) {
      setSendError(err.message || "Failed to clear chat");
    } finally {
      setClearing(false);
    }
  }

  function handleKeyDown(e) {
    // Send on Enter, newline on Shift+Enter
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div>
          <h3 style={{ margin: 0 }}>Ask the tutor</h3>
          <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.85rem" }}>
            {nodeTitle
              ? `Chatting about "${nodeTitle}". The AI sees your full course context.`
              : "The AI sees your full course context."}
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={handleClear}
          disabled={clearing || loading || messages.length === 0}
          style={{ marginTop: 0 }}
        >
          {clearing ? "Clearing..." : "Clear chat"}
        </button>
      </div>

      <div className="chat-list" ref={listRef}>
        {loading && <LoadingState message="Loading chat..." />}
        {error && <ErrorState message={error} />}

        {!loading && !error && messages.length === 0 && (
          <div className="chat-empty">
            No questions yet. Ask the tutor anything about this node — your
            follow-ups will keep the same context.
          </div>
        )}

        {!loading &&
          messages.map((m) => (
            <div key={m.id} className={`chat-message ${m.role}`}>
              <div className="chat-bubble">
                <div className="chat-bubble-text">
                  {m.role === "user" ? (
                    <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                  ) : (
                    renderMarkdown(m.content)
                  )}
                </div>
                <div className="chat-bubble-meta">
                  {m.role === "user" ? "You" : "Tutor"} · {formatTime(m.createdAt)}
                </div>
              </div>
            </div>
          ))}

        {sending && (
          <div className="chat-message assistant">
            <div className="chat-bubble chat-bubble-pending">
              <div className="chat-bubble-text muted">Tutor is typing…</div>
            </div>
          </div>
        )}
      </div>

      {sendError && <ErrorState message={sendError} />}

      <form className="chat-input" onSubmit={handleSend}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up... (Enter to send, Shift+Enter for newline)"
          disabled={sending}
          rows={2}
        />
        <button type="submit" className="primary" disabled={sending || !draft.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}