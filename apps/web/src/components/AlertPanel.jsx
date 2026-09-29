import React from 'react';
import { AlertCircle, Eye, Send, Users, Clock, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function AlertPanel() {
  const { alerts, setActiveModalAlert, setFlyToLocation } = useStore();

  const getDistrictPopulation = (districtId) => {
    const popMap = {
      kolkata: '4.5M',
      north_24_parganas: '10.0M',
      south_24_parganas: '8.2M',
      howrah: '4.9M',
      hooghly: '5.5M',
      nadia: '5.2M',
      purba_medinipur: '5.1M',
      paschim_medinipur: '5.9M',
      purba_bardhaman: '4.8M',
      bankura: '3.6M',
    };
    return popMap[districtId] || '4.0M';
  };

  return (
    <div className="glass-panel rounded-xl p-3.5 border border-slate-800 shadow-md flex-1 flex flex-col min-h-0 select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>Impact-Based Alerts ({alerts.length})</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Prob &ge; 50%</span>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
            ✓
          </span>
          <span>No severe thunderstorm alerts for this lead horizon.</span>
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
          {alerts.map((alert) => {
            const isApproved = alert.status === 'approved';
            const isSevere = alert.severity === 'severe';
            const isWarning = alert.severity === 'warning';

            return (
              <div
                key={alert.id}
                className={`p-3 rounded-xl border transition-all ${
                  isSevere
                    ? 'bg-rose-950/40 border-rose-600/80 shadow-sm shadow-rose-950/40'
                    : isWarning
                    ? 'bg-orange-950/40 border-orange-600/80 shadow-sm shadow-orange-950/30'
                    : 'bg-yellow-950/35 border-yellow-400/70 shadow-sm shadow-yellow-950/20'
                }`}
              >
                {/* Top Row: District & Severity Badge */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-white">
                    {alert.district_name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isApproved && (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50 uppercase">
                        Sent
                      </span>
                    )}
                    <span
                      className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded border ${
                        isSevere
                          ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse'
                          : isWarning
                          ? 'bg-orange-950 text-orange-300 border-orange-600'
                          : 'bg-yellow-950 text-yellow-300 border-yellow-400'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-1 py-1.5 my-1.5 border-y border-slate-800/60 text-[10px] text-slate-300 font-mono">
                  <div className="flex flex-col">
                    <span className="text-slate-400 flex items-center gap-0.5 text-[9px]">
                      <Clock className="w-2.5 h-2.5" /> ETA
                    </span>
                    <span className="font-bold text-amber-300">~{alert.eta_min} min</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 flex items-center gap-0.5 text-[9px]">
                      <Zap className="w-2.5 h-2.5" /> Peak Prob
                    </span>
                    <span className="font-bold text-cyan-300">
                      {Math.round(alert.peak_prob * 100)}%
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 flex items-center gap-0.5 text-[9px]">
                      <Users className="w-2.5 h-2.5" /> Exposure
                    </span>
                    <span className="font-bold text-slate-200">
                      {getDistrictPopulation(alert.district_id)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setActiveModalAlert(alert)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-all"
                  >
                    <Eye className="w-3 h-3 text-cyan-400" />
                    <span>Preview Alert</span>
                  </button>

                  <button
                    onClick={() => setActiveModalAlert(alert)}
                    className={`flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg text-[11px] font-bold transition-all ${
                      isApproved
                        ? 'bg-slate-800 text-emerald-400 border border-emerald-800/40'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30'
                    }`}
                  >
                    <Send className="w-3 h-3" />
                    <span>{isApproved ? 'Details' : 'Approve'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
