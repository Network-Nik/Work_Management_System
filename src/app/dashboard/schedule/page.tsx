export default function SchedulePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-6">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Schedule</h1>
      <p className="mt-2 text-zinc-400 max-w-sm mx-auto">
        Your calendar and timeline view of assigned work will appear here. Coming soon in a future update.
      </p>
    </div>
  );
}

