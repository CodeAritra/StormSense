import React from 'react';
import { Navigation2, CloudLightning, Compass } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function StormCellList() {
  const { forecast, setFlyToLocation, setSelectedStormCell } = useStore();
  const cells = forecast?.storm_cells || [];

  const handleCellClick = (cell) => {
    setSelectedStormCell(cell);
    setFlyToLocation({
      center: [cell.lon, cell.lat],
      zoom: 9.5,
    });
  };

  return (
    <div className="glass-panel rounded-xl p-3.5 border border-slate-800 shadow-md">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
          <CloudLightning className="w-3.5 h-3.5 text-cyan-400" />
          <span>Active Convective Cells ({cells.length})</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">VIL &gt; 0.40</span>
      </div>

      {cells.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-500">
          No severe convective cells detected in current frame.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {cells.map((cell) => {
            const isVerySevere = cell.max_vil >= 0.75;
            return (
              <button
                key={cell.id}
                onClick={() => handleCellClick(cell)}
                className="w-full text-left p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-xs ${
                      isVerySevere
                        ? 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
                        : 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                    }`}
                  >
                    {cell.id}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white">
                        VIL {cell.max_vil.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ({cell.area_km2} km²)
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {cell.lat.toFixed(2)}°N, {cell.lon.toFixed(2)}°E
                    </div>
                  </div>
                </div>

                {/* Motion arrow & speed */}
                <div className="flex items-center gap-1.5 text-right font-mono text-[11px] text-slate-300">
                  <div className="flex flex-col items-end">
                    <span className="font-semibold text-cyan-400">{cell.motion_kmh} km/h</span>
                    <span className="text-[9px] text-slate-400">{cell.heading_deg}°</span>
                  </div>
                  <div
                    className="p-1 rounded bg-slate-800 text-cyan-400 transform group-hover:scale-110 transition-transform"
                    style={{ transform: `rotate(${cell.heading_deg}deg)` }}
                    title={`Heading ${cell.heading_deg} degrees`}
                  >
                    <Navigation2 className="w-3 h-3 fill-current" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
