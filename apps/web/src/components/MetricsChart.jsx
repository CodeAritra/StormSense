import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function MetricsChart({ metricKey = 'csi', data, title, description }) {
  if (!data || !data.lead_minutes) return null;

  // Format data for Recharts: array of objects with lead_min, persistence, optical_flow, model
  const chartData = data.lead_minutes.map((min, idx) => ({
    min: `+${min}m`,
    persistence: data[metricKey]?.persistence?.[idx] ?? 0,
    optical_flow: data[metricKey]?.optical_flow?.[idx] ?? 0,
    model: data[metricKey]?.model?.[idx] ?? 0,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs font-mono">
          <div className="font-bold text-white mb-1.5">{label} Horizon</div>
          {payload.map((entry, index) => (
            <div key={index} className="flex justify-between gap-3 text-[11px]" style={{ color: entry.color }}>
              <span>{entry.name}:</span>
              <span className="font-bold">{entry.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          {title}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="min" stroke="#64748b" textAnchor="middle" tick={{ fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 1]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) => {
                const map = {
                  persistence: 'Persistence Baseline',
                  optical_flow: 'Optical Flow Baseline',
                  model: 'StormSense AI Model',
                };
                return <span className="text-slate-300 font-medium">{map[value] || value}</span>;
              }}
            />
            <Line
              type="monotone"
              dataKey="persistence"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="optical_flow"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="model"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
