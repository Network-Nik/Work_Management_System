export default function DashboardLoading() {
  return (
    <div className="animate-pulse flex flex-col gap-6">
      <div className="h-8 w-48 bg-zinc-800 rounded-lg"></div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl"></div>
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl"></div>
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl"></div>
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl"></div>
      </div>
    </div>
  );
}

