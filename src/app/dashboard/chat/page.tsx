export default function ChatEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 h-full p-6 text-center">
      <svg className="w-12 h-12 mb-4 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <h3 className="text-lg font-medium text-zinc-300">Your Workspace Chat</h3>
      <p className="mt-1 text-sm">Select a conversation to start messaging.</p>
    </div>
  );
}
