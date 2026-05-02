import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../stores/chatStore";
import { useAuthStore } from "../stores/authStore";

export function Chat() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const error = useChatStore((s) => s.error);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const clearError = useChatStore((s) => s.clearError);
  const openSignIn = useAuthStore((s) => s.openSignIn);

  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function submit() {
    if (!draft.trim() || isLoading) return;
    const text = draft;
    setDraft("");
    await sendMessage(text);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="chat">
      <div className="chat-toolbar">
        <span className="chat-title">Chat</span>
        {messages.length > 0 && (
          <button onClick={clearMessages} className="btn btn-ghost">Clear</button>
        )}
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Send a message — PromptRoute auto-picks the best model on-device.</p>
            <p className="hint">Free tier gets 3 messages on the hosted model. Sign in to bring your own provider keys or upgrade for more.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            <div className="msg-header">
              <span className="msg-role">{m.role}</span>
              {m.decision && (
                <span className="msg-route">
                  {m.decision.provider} / {m.decision.model}
                  {" · "}
                  {(m.decision.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <div className="msg-content">{m.content}</div>
          </div>
        ))}
        {isLoading && <div className="msg msg-assistant pending">…</div>}
      </div>

      {error && (
        <div className="chat-error">
          {error === "__CHAT_LIMIT_REACHED__" ? (
            <>
              <span>Free tier limit reached.</span>
              <button onClick={openSignIn} className="btn btn-primary btn-sm">
                Sign in / upgrade
              </button>
              <button onClick={clearError} className="btn btn-ghost btn-sm">
                Dismiss
              </button>
            </>
          ) : (
            <>
              <span>{error}</span>
              <button onClick={clearError} className="btn btn-ghost btn-sm">
                Dismiss
              </button>
            </>
          )}
        </div>
      )}

      <div className="chat-input">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type a message — Enter to send, Shift+Enter for newline"
          disabled={isLoading}
        />
        <button
          onClick={submit}
          disabled={!draft.trim() || isLoading}
          className="btn btn-primary"
        >
          {isLoading ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
