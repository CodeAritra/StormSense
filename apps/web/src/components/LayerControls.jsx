import React from 'react';
import { Layers, Eye, EyeOff, Sliders } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function LayerControls() {
  const {
    layerVisibility,
    toggleLayer,
    overlayOpacity,
    setOverlayOpacity,
  } = useStore();

  const layers = [
    { key: 'predictedRadar', label: 'Predicted Radar', color: 'bg-emerald-400' },
    { key: 'lightningRisk', label: 'Lightning Risk', color: 'bg-amber-400' },
    { key: 'radarNow', label: 'Radar Now (T0)', color: 'bg-cyan-400' },
    { key: 'actualRadar', label: 'Actual Radar (Truth)', color: 'bg-blue-400' },
    { key: 'districts', label: 'District Boundaries', color: 'bg-indigo-400' },
    { key: 'stormCells', label: 'Storm Cell Markers', color: 'bg-rose-400' },
  ];

  return (
    <div className="glass-panel rounded-xl p-3.5 shadow-lg border border-slate-800 text-xs w-64 select-none">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Layer Visibility</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          {Math.round(overlayOpacity * 100)}%
        </span>
      </div>

      {/* Layer Toggles */}
      <div className="space-y-1.5">
        {layers.map((l) => {
          const active = layerVisibility[l.key];
          return (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all ${
                active
                  ? 'bg-slate-800/80 text-white font-medium'
                  : 'bg-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${l.color} ${
                    active ? 'opacity-100 shadow-sm' : 'opacity-30'
                  }`}
                />
                <span>{l.label}</span>
              </div>
              {active ? (
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Opacity Slider */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <span className="flex items-center gap-1">
            <Sliders className="w-3 h-3 text-slate-400" />
            <span>Overlay Opacity</span>
          </span>
          <span className="font-mono text-slate-300 font-semibold">
            {Math.round(overlayOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.05"
          value={overlayOpacity}
          onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
      </div>
    </div>
  );
}
