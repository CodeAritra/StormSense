import React from 'react';
import { Timer, Zap } from 'lucide-react';

export default function LatencyBadge({ timing, backend = 'mock' }) {
  const totalMs = timing?.total_ms ?? 78.4;
  const inferMs = timing?.inference_ms ?? 41.2;
  const renderMs = timing?.render_ms ?? 30.5;
  const alertMs = timing?.alert_ms ?? 3.1;

  // Target is under 2 minutes (120,000 ms)
  const isTargetMet = totalMs < 120000;

  return (
    <div
      id="latency-badge"
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-panel text-xs text-slate-300 shadow-sm border border-slate-700/60"
      title={`Breakdown: Inference: ${inferMs}ms, Render: ${renderMs}ms, Alerts: ${alertMs}ms`}
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
        <span className="text-slate-400 font-normal">(replay)</span>
      </div>

      <div className="hidden lg:flex items-center gap-1 ml-1 pl-2 border-l border-slate-700 text-[11px] text-slate-400">
        <span className="text-slate-300">Infer:</span> {inferMs.toFixed(0)}ms
      </div>
    </div>
  );
}
