"use client";

import { useState } from "react";
import { postAssignmentComment } from "@/app/dashboard/actions";
import { useRouter } from "next/navigation";

export function CommentForm({ assignmentId }: { assignmentId: string }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = content.trim();
    if (!val) return;
    if (val.length > 2000) {
      setError("Comment exceeds 2000 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await postAssignmentComment(assignmentId, val);
    
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setContent("");
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment or update..."
          className="w-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 rounded-xl px-4 py-3 min-h-[100px] focus:outline-none focus:ring-1 focus:ring-zinc-700 resize-none placeholder-zinc-500"
          disabled={loading}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-3">
          <span className="text-[10px] text-zinc-500 font-mono">
            {content.length}/2000
          </span>
          <button
            type="submit"
            disabled={!content.trim() || loading || content.length > 2000}
            className="px-4 py-1.5 bg-zinc-100 text-zinc-900 text-xs font-semibold rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
          >
            {loading ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </form>
  );
}
