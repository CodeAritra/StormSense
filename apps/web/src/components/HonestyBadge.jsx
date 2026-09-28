import React from 'react';
import { Info, ThumbsUp, Activity } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function HonestyBadge() {
  const { feedbackSummary } = useStore();
  const hitRatePct = Math.round(feedbackSummary.hit_rate * 100);

  return (
    <footer className="h-8 px-4 bg-storm-950/95 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 z-20 select-none">
      {/* Transparency / Honesty Label */}
      <div className="flex items-center gap-1.5 text-slate-400 truncate">
        <Info className="w-3 h-3 text-cyan-400 flex-shrink-0" />
        <span className="font-semibold text-slate-300">Demo Mapping:</span>
        <span className="truncate">
          Replay data georeferenced to South Bengal demo corridor. Model pipeline is sensor-agnostic.
        </span>
      </div>

      {/* Feedback loop summary */}
      <div className="flex items-center gap-3 font-mono text-[10px]">
        <div className="flex items-center gap-1 text-slate-300">
          <Activity className="w-3 h-3 text-emerald-400" />
          <span>Forecaster Hit Rate:</span>
          <span className="font-bold text-emerald-400">
            {feedbackSummary.total > 0 ? `${hitRatePct}%` : 'N/A'}
          </span>
          <span className="text-slate-500">({feedbackSummary.total} reviews)</span>
        </div>

        <div className="hidden sm:inline text-slate-600">|</div>

        <div className="hidden sm:flex items-center gap-1 text-slate-400">
          <span>Grid: 128x128 (~3 km)</span>
        </div>
      </div>
    </footer>
  );
}
