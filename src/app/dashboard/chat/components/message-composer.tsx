"use client";

import { useState, useRef, FormEvent } from "react";
import { sendMessage } from "../actions";

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    if (trimmed.length > 2000) {
      setError("Message exceeds 2000 characters.");
      return;
    }

    setLoading(true);
    setError("");

    const res = await sendMessage(conversationId, trimmed);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 bg-zinc-900 border-t border-zinc-800">
      {error && (
        <div className="mb-2 text-xs text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="relative flex items-end bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message..."
          disabled={loading}
          className="w-full max-h-48 min-h-[44px] bg-transparent text-zinc-100 text-sm px-4 py-3 resize-none focus:outline-none disabled:opacity-50"
          rows={1}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = `${target.scrollHeight}px`;
          }}
        />
        <button
          type="submit"
          disabled={!content.trim() || loading || content.length > 2000}
          className="p-2 m-1.5 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        >
          {loading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>
      <div className="flex justify-end mt-1 px-2">
        <span className={`text-[10px] ${content.length > 2000 ? "text-red-400" : "text-zinc-600"}`}>
          {content.length} / 2000
        </span>
      </div>
    </div>
  );
}
