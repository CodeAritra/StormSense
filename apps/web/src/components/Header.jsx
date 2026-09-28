import React from 'react';
import { Play, Pause, Zap, BarChart2, ShieldAlert, FastForward, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import LatencyBadge from './LatencyBadge';

export default function Header() {
  const {
    events,
    selectedEventId,
    setSelectedEventId,
    replayState,
    setReplayState,
    forecast,
    currentPage,
    setCurrentPage,
  } = useStore();

  const isPlaying = replayState?.playing;
  const speed = replayState?.speed || 1.0;
  const currentIndex = replayState?.current_index ?? 12;
  const maxIndex = replayState?.max_index ?? 36;
  const backend = forecast?.backend || 'mock';

  // Calculate simulated event clock (start_time + currentIndex * 5 min)
  const currentEvent = events.find((e) => e.id === selectedEventId);
  const baseTimeStr = currentEvent?.start_time_utc || '2019-07-10T09:00:00Z';
  const baseDate = new Date(baseTimeStr);
  const simDate = new Date(baseDate.getTime() + currentIndex * 5 * 60 * 1000);
  
  const utcString = simDate.toISOString().substring(11, 16) + ' UTC';
  // IST is UTC + 5:30
  const istDate = new Date(simDate.getTime() + 5.5 * 60 * 60 * 1000);
  const istString = istDate.toISOString().substring(11, 16) + ' IST';

  const handleTogglePlay = async () => {
    try {
      if (isPlaying) {
        const next = await api.pauseReplay();
        setReplayState(next);
      } else {
        const next = await api.resumeReplay();
        setReplayState(next);
      }
    } catch (err) {
      console.error('Play/Pause failed:', err);
    }
  };

  const handleSpeedChange = async (newSpeed) => {
    try {
      const next = await api.startReplay(selectedEventId, newSpeed, currentIndex);
      setReplayState(next);
    } catch (err) {
      console.error('Speed change failed:', err);
    }
  };

  const handleEventChange = async (e) => {
    const newEventId = e.target.value;
    setSelectedEventId(newEventId);
    try {
      const next = await api.startReplay(newEventId, speed, 12);
      setReplayState(next);
    } catch (err) {
      console.error('Event switch failed:', err);
    }
  };

  return (
    <header className="h-16 px-4 bg-storm-950/90 border-b border-slate-800 flex items-center justify-between gap-4 z-30 select-none">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20 text-white font-bold text-lg">
          ⚡
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 font-sans">
              StormSense
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                AI Nowcast
              </span>
            </h1>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Ministry of Earth Sciences / IMD Prototype
          </p>
        </div>
      </div>

      {/* Replay Controls & Catalog */}
      <div className="flex items-center gap-3">
        {/* Event selector */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
          <span className="text-slate-400 font-medium">Event:</span>
          <select
            id="event-select"
            value={selectedEventId}
            onChange={handleEventChange}
            className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
          >
            {events.length > 0 ? (
              events.map((evt) => (
                <option key={evt.id} value={evt.id} className="bg-slate-900 text-white">
                  {evt.title || evt.id}
                </option>
              ))
            ) : (
              <option value="evt_001" className="bg-slate-900 text-white">
                Nor'wester Demo Event
              </option>
            )}
          </select>
        </div>

        {/* Play/Pause & Speed */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1">
          <button
            id="btn-play-pause"
            onClick={handleTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-sm shadow-cyan-500/30'
            }`}
            title="Spacebar to toggle play/pause"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Replay</span>
              </>
            )}
          </button>

          {/* Speed Buttons */}
          <div className="flex items-center border-l border-slate-800 pl-1 ml-1">
            {[1.0, 2.0, 4.0].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-2 py-1 text-[11px] font-mono rounded transition-colors ${
                  speed === s
                    ? 'bg-slate-800 text-cyan-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="px-2 text-[11px] font-mono text-slate-400 border-l border-slate-800">
            F:{currentIndex}/{maxIndex}
          </div>
        </div>

        {/* Simulation Clock */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="font-bold text-white text-sm">{istString}</span>
            <span className="text-slate-400 text-[11px]">({utcString})</span>
          </div>
        </div>
      </div>

      {/* Latency & Badges & Page Switcher */}
      <div className="flex items-center gap-3">
        {/* Latency badge */}
        <LatencyBadge timing={forecast?.timing} backend={backend} />

        {/* Backend badge */}
        <div
          id="backend-badge"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold border ${
            backend === 'onnx'
              ? 'bg-violet-950/40 text-violet-300 border-violet-700/60'
              : 'bg-cyan-950/40 text-cyan-300 border-cyan-800/60'
          }`}
          title={
            backend === 'onnx'
              ? 'ONNX Runtime CPU Inference Active'
              : 'Mock Inference Active (Swappable with models/nowcast.onnx)'
          }
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          <span>backend:{backend}</span>
        </div>

        {/* Page Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
          <button
            id="tab-dashboard"
            onClick={() => setCurrentPage('dashboard')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              currentPage === 'dashboard'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            id="tab-metrics"
            onClick={() => setCurrentPage('metrics')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-all ${
              currentPage === 'metrics'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>AI vs Baseline</span>
          </button>
        </div>
      </div>
    </header>
  );
}
