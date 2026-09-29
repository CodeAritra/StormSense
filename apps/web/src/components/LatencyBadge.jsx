import React from 'react';
import { Timer } from 'lucide-react';

export default function LatencyBadge({ timing, backend = 'mock' }) {
  const totalMs = timing?.total_ms ?? 78.4;
  // Target is under 2 minutes (120,000 ms)
  const isTargetMet = totalMs < 120000;

  return (
    <div
      id="latency-badge"
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-panel text-xs text-slate-300 shadow-sm border border-slate-700/60 flex-shrink-0"
      title={`End-to-End Latency: ${totalMs.toFixed(1)}ms (${backend} mode)`}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <span
          className={`h-2 w-2 rounded-full ${
            isTargetMet ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
          }`}
        />
        <Timer className="w-3.5 h-3.5 text-cyan-400" />
        <span>Data to Alert:</span>
      </div>

      <div className="flex items-center gap-1 font-mono font-semibold text-slate-100">
        <span className={totalMs < 500 ? 'text-emerald-400' : 'text-amber-400'}>
          {totalMs.toFixed(1)} ms
        </span>
        <span className="text-slate-400 font-normal text-[10px]">(replay)</span>
      </div>
    </div>
  );
}

