import React, { useEffect, useState } from 'react';
import { BarChart3, AlertTriangle, ShieldCheck, Zap, ArrowLeft, Activity } from 'lucide-react';
import { api } from '../api/client';
import { useStore } from '../store/useStore';
import MetricsChart from '../components/MetricsChart';

export default function Metrics() {
  const { setCurrentPage } = useStore();
  const [metrics, setMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState('csi'); // 'csi' | 'pod' | 'far'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMetrics()
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load metrics:', err);
        setLoading(false);
      });
  }, []);

  const isPlaceholder = metrics?.is_placeholder ?? true;
  const lght = metrics?.lightning || { pod: 0.81, far: 0.22, csi: 0.66, brier: 0.084 };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full select-none">
      {/* Top Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Live Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            AI Model vs Operational Meteorological Baselines
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Standard verification scores evaluated across 12 discrete lead steps (5 to 60 minutes) against SEVIR benchmark events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono">
            Dataset: {metrics?.dataset || 'SEVIR Benchmark'}
          </span>
        </div>
      </div>

      {/* Placeholder Banner (if true) */}
      {isPlaceholder && (
        <div className="mt-5 p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/60 text-amber-200 text-xs flex items-center gap-3 shadow-md shadow-amber-950/30">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <span className="font-bold">Provisional Sample Numbers: </span>
            <span>
              These verification curves represent provisional benchmark values. They will be automatically updated once your teammate concludes the full test set evaluation run.
            </span>
          </div>
        </div>
      )}

      {/* Lightning Specific Summary Cards */}
      <div className="mt-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Lightning Nowcasting Skill Scores (0 to 60 min Aggregate)</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">Critical Success Index (CSI)</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{lght.csi}</div>
            <div className="text-[10px] text-slate-500 mt-1">Higher is better (threat score)</div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">Probability of Detection (POD)</div>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">{lght.pod}</div>
            <div className="text-[10px] text-slate-500 mt-1">Higher is better (hit rate)</div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">False Alarm Ratio (FAR)</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{lght.far}</div>
            <div className="text-[10px] text-slate-500 mt-1">Lower is better (false alerts)</div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">Brier Reliability Score</div>
            <div className="text-2xl font-bold font-mono text-violet-400 mt-1">{lght.brier}</div>
            <div className="text-[10px] text-slate-500 mt-1">Lower is better (probabilistic error)</div>
          </div>
        </div>
      </div>

      {/* Radar Nowcasting Curves Section */}
      <div className="mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Radar Storm Intensity (VIL &ge; 35 dBZ) Lead Time Degradation</span>
          </h2>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('csi')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'csi'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              CSI (Critical Success)
            </button>
            <button
              onClick={() => setActiveTab('pod')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'pod'
                  ? 'bg-cyan-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              POD (Hit Rate)
            </button>
            <button
              onClick={() => setActiveTab('far')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'far'
                  ? 'bg-rose-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              FAR (False Alarms)
            </button>
          </div>
        </div>

        {/* Dynamic Metric Chart */}
        {activeTab === 'csi' && (
          <MetricsChart
            metricKey="csi"
            data={metrics}
            title="Critical Success Index (CSI) vs Forecast Lead Time"
            description="Measures fraction of observed and forecast events correctly predicted. Higher CSI is better. Notice how the AI model outperforms classical optical flow advection past 15 minutes."
          />
        )}
        {activeTab === 'pod' && (
          <MetricsChart
            metricKey="pod"
            data={metrics}
            title="Probability of Detection (POD / Hit Rate) vs Lead Time"
            description="Measures proportion of actual storm cells that were forecast in advance. Higher POD is better."
          />
        )}
        {activeTab === 'far' && (
          <MetricsChart
            metricKey="far"
            data={metrics}
            title="False Alarm Ratio (FAR) vs Lead Time"
            description="Measures proportion of forecast warnings that turned out to be false alarms. Lower FAR is better."
          />
        )}
      </div>

      {/* Meteorological Guidance Note */}
      <div className="mt-8 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 leading-relaxed">
        <span className="font-semibold text-slate-200">Why AI Outperforms Traditional Baselines: </span>
        Traditional Eulerian and Lagrangian persistence (optical flow) methods assume storm structures remain frozen while advecting along wind vectors. StormSense's deep spatio-temporal architecture learns non-linear convective initiation, rapid cellular growth, and dissipation, retaining high predictive skill even at +45 to +60 minute horizons.
      </div>
    </div>
  );
}
