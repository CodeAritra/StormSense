import React, { useEffect } from 'react';
import { Play, Pause, GitCompare, Info, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { LEAD_MINUTES } from '../types';

export default function TimeSlider() {
  const {
    leadIndex,
    setLeadIndex,
    isForecastAnimating,
    setIsForecastAnimating,
    compareWithActual,
    setCompareWithActual,
    compareBlend,
    setCompareBlend,
  } = useStore();

  // Stops: -1 (Now), 0 (+5m), 1 (+10m), ... 11 (+60m)
  const stops = [-1, ...LEAD_MINUTES.map((_, i) => i)];

  // Autoplay loop animation for forecast timeline
  useEffect(() => {
    let interval = null;
    if (isForecastAnimating) {
      interval = setInterval(() => {
        setLeadIndex((prev) => (prev >= 11 ? 0 : prev + 1));
      }, 900);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isForecastAnimating, setLeadIndex]);

  // Confidence assessment based on lead time
  const getConfidenceInfo = (idx) => {
    if (idx === -1) {
      return { text: 'Observed Radar', level: 'Observed', color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/50' };
    }
    const mins = LEAD_MINUTES[idx];
    if (mins <= 20) {
      return { text: 'High Confidence', level: '0-20 min', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50' };
    }
    if (mins <= 40) {
      return { text: 'Medium Confidence', level: '25-40 min', color: 'text-amber-400 bg-amber-950/40 border-amber-800/50' };
    }
    return { text: 'Lower Confidence', level: '45-60 min', color: 'text-rose-400 bg-rose-950/40 border-rose-800/50' };
  };

  const confidence = getConfidenceInfo(leadIndex);

  return (
    <div className="w-full glass-panel border-t border-slate-800 px-6 py-3 select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Play Loop & Label */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <button
            id="btn-animate-forecast"
            onClick={() => setIsForecastAnimating(!isForecastAnimating)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isForecastAnimating
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            title="Loop through forecast lead times (+5 to +60 min)"
          >
            {isForecastAnimating ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Forecast</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Animate Lead Times</span>
              </>
            )}
          </button>

          {/* Current Lead Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Forecast Horizon:</span>
            <span className="text-sm font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
              {leadIndex === -1 ? 'Now (T0)' : `+${LEAD_MINUTES[leadIndex]} min`}
            </span>
          </div>

          {/* Confidence indicator badge */}
          <div
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${confidence.color} font-medium`}
            title="Uncertainty increases with lead time due to atmospheric non-linearity"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{confidence.text}</span>
          </div>
        </div>

        {/* 13-Stop Interactive Slider Track */}
        <div className="flex-1 w-full max-w-2xl px-2">
          <div className="relative flex items-center justify-between">
            {/* Background connection track */}
            <div className="absolute left-0 right-0 h-1 bg-slate-800 rounded-full z-0" />
            
            {/* Active progress fill */}
            <div
              className="absolute left-0 h-1 bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full z-0 transition-all duration-150"
              style={{
                width: `${((leadIndex + 1) / 12) * 100}%`,
              }}
            />

            {/* Stops */}
            {stops.map((stopIndex) => {
              const isSelected = leadIndex === stopIndex;
              const isNow = stopIndex === -1;
              const label = isNow ? 'Now' : `+${LEAD_MINUTES[stopIndex]}m`;

              return (
                <button
                  key={stopIndex}
                  onClick={() => {
                    setIsForecastAnimating(false);
                    setLeadIndex(stopIndex);
                  }}
                  className="relative z-10 flex flex-col items-center group focus:outline-none"
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                      isSelected
                        ? 'bg-cyan-400 border-white scale-125 shadow-lg shadow-cyan-400/50'
                        : isNow
                        ? 'bg-slate-700 border-cyan-500 group-hover:bg-cyan-600'
                        : 'bg-slate-900 border-slate-700 group-hover:border-slate-500'
                    }`}
                  />
                  <span
                    className={`mt-1.5 text-[10px] font-mono transition-colors ${
                      isSelected
                        ? 'text-cyan-400 font-bold'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compare with Ground Truth Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end border-t md:border-t-0 md:border-l border-slate-800/80 pt-2 md:pt-0 md:pl-4">
          <button
            id="btn-compare-actual"
            onClick={() => setCompareWithActual(!compareWithActual)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              compareWithActual
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Blend predicted radar against actual truth radar"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Actual</span>
          </button>

          {compareWithActual && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
              <span>Pred</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={compareBlend}
                onChange={(e) => setCompareBlend(parseFloat(e.target.value))}
                className="w-16 h-1 bg-slate-800 rounded appearance-none accent-blue-400 cursor-pointer"
                title="Crossfade blend: Left = 100% Predicted, Right = 100% Actual Truth"
              />
              <span>Truth</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
