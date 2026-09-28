import React from 'react';
import { HelpCircle, Cpu, Radio, Satellite, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function ExplainPanel() {
  const { forecast } = useStore();
  const explain = forecast?.explain || { radar: 0.55, satellite: 0.25, lightning: 0.20 };
  const isMock = (forecast?.backend || 'mock') === 'mock';

  const items = [
    {
      key: 'radar',
      label: 'Doppler Radar (VIL)',
      pct: Math.round(explain.radar * 100),
      color: 'bg-emerald-400',
      icon: Radio,
    },
    {
      key: 'satellite',
      label: 'INSAT Satellite (IR)',
      pct: Math.round(explain.satellite * 100),
      color: 'bg-cyan-400',
      icon: Satellite,
    },
    {
      key: 'lightning',
      label: 'Lightning Network (GLD)',
      pct: Math.round(explain.lightning * 100),
      color: 'bg-amber-400',
      icon: Zap,
    },
  ];

  return (
    <div className="glass-panel rounded-xl p-3.5 border border-slate-800 shadow-md text-xs select-none">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Multimodal Input Attribution</span>
        </div>
        {isMock && (
          <span className="text-[10px] text-amber-400/90 font-mono bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
            placeholder attribution
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mb-2.5">
        Which sensor input drove this AI forecast:
      </p>

      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key}>
              <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Icon className="w-3 h-3 text-slate-400" />
                  <span>{item.label}</span>
                </span>
                <span className="font-mono font-bold text-white">{item.pct}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.color} transition-all duration-300`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
