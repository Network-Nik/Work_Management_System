"use client";

import { useEffect, useState, useTransition } from "react";
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";
import { getCompanyProgressAction } from "../actions";

type Period = "7d" | "30d" | "1y";

type BucketData = {
  bucket: string;
  completed_count: number;
};

const formatDate = (dateString: string, period: Period) => {
  const d = new Date(dateString);
  if (period === "1y") {
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const CustomTooltip = ({ active, payload, label, period }: { active?: boolean; payload?: { value: number }[]; label?: string; period: Period }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg shadow-xl">
        <p className="text-zinc-400 text-xs mb-1">{label ? formatDate(label, period) : ""}</p>
        <p className="text-zinc-100 text-sm font-medium">
          <span className="text-indigo-400 font-bold">{payload[0].value}</span> completed
        </p>
      </div>
    );
  }
  return null;
};

export function CompanyProgressChart() {
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<BucketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;
    
    async function loadData() {
      setLoading(true);
      setError(false);
      
      const res = await getCompanyProgressAction(period);
      
      if (!isMounted) return;
      
      if (res.error) {
        setError(true);
      } else if (res.data) {
        setData(res.data as BucketData[]);
      }
      setLoading(false);
    }
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [period]);

  const handlePeriodChange = (newPeriod: Period) => {
    startTransition(() => {
      setPeriod(newPeriod);
    });
  };

  return (
    <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-5 md:p-6 flex flex-col h-80 relative overflow-hidden">
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Company Progress</h2>
          <p className="text-sm text-zinc-400">Formal assignments completed over time</p>
        </div>
        
        <div className="flex bg-zinc-950/50 p-1 rounded-lg border border-zinc-800/50">
          {(["7d", "30d", "1y"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                period === p 
                  ? "bg-zinc-800 text-zinc-100 shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 w-full relative min-h-0">
        {(loading || isPending) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[1px] animate-in fade-in rounded-xl">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {error && !loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center text-zinc-500 text-sm">
            Failed to load progress data
          </div>
        )}

        {!error && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip content={<CustomTooltip period={period} />} cursor={{ stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area 
                type="monotone" 
                dataKey="completed_count" 
                stroke="#6366f1" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorCount)" 
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {!error && !loading && data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
            No formal work completed in this timeframe
          </div>
        )}
      </div>
    </div>
  );
}
