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
  const dateString = simDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

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
    <header className="h-16 px-3 md:px-5 bg-storm-950/95 border-b border-slate-800/90 flex items-center justify-between gap-2 md:gap-4 z-30 select-none backdrop-blur-md">
      {/* Brand & Identity */}
      <div
        className="flex items-center gap-2.5 flex-shrink-0 cursor-pointer group"
        onClick={() => setCurrentPage('dashboard')}
        title="Go to Live Dashboard"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20 text-white font-bold text-base group-hover:scale-105 transition-transform">
          ⚡
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm md:text-base font-bold tracking-tight text-white flex items-center gap-1 font-sans">
              StormSense
              <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                AI Nowcast
              </span>
            </h1>
          </div>
          <p className="text-[10px] text-slate-400 font-medium hidden md:block leading-tight">
            Ministry of Earth Sciences / IMD Prototype
          </p>
        </div>
      </div>

      {/* Replay Controls & Catalog */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Event selector */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 shadow-inner">
          <span className="text-slate-400 font-medium text-[11px] hidden sm:inline">Event:</span>
          <select
            id="event-select"
            value={selectedEventId}
            onChange={handleEventChange}
            className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer max-w-[110px] sm:max-w-[160px] truncate"
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
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-0.5">
          <button
            id="btn-play-pause"
            onClick={handleTogglePlay}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-sm shadow-cyan-500/30'
            }`}
            title="Spacebar to toggle play/pause"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Play</span>
              </>
            )}
          </button>

          {/* Speed Dropdown */}
          <div className="flex items-center border-l border-slate-800 pl-1.5 ml-0.5">
            <select
              id="speed-select"
              value={speed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="bg-transparent text-cyan-400 font-mono text-[11px] font-bold focus:outline-none cursor-pointer py-1 px-1 rounded hover:bg-slate-800/80 transition-colors"
              title="Replay playback speed"
            >
              <option value="0.5" className="bg-slate-900 text-white">0.5x</option>
              <option value="1" className="bg-slate-900 text-white">1.0x</option>
              <option value="2" className="bg-slate-900 text-white">2.0x</option>
              <option value="4" className="bg-slate-900 text-white">4.0x</option>
            </select>
          </div>

          <div className="px-1.5 text-[10px] font-mono text-slate-400 border-l border-slate-800 hidden xs:block">
            F:{currentIndex}/{maxIndex}
          </div>
        </div>

        {/* Simulation Date & Clock */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs shadow-inner">
          <Clock className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="font-bold text-amber-300 text-xs">{dateString}</span>
            <span className="text-slate-600 font-bold">•</span>
            <span className="font-bold text-white text-xs">{istString}</span>
            <span className="text-slate-400 text-[10px]">({utcString})</span>
          </div>
        </div>
      </div>

      {/* Latency & Badges & Page Switcher */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Latency badge */}
        <div className="hidden sm:block">
          <LatencyBadge timing={forecast?.timing} backend={backend} />
        </div>

        {/* Page Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs flex-shrink-0 shadow-sm">
          <button
            id="tab-dashboard"
            onClick={() => setCurrentPage('dashboard')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              currentPage === 'dashboard'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Dashboard
          </button>
          <button
            id="tab-metrics"
            onClick={() => setCurrentPage('metrics')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              currentPage === 'metrics'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI vs Baseline</span>
            <span className="sm:hidden">Metrics</span>
          </button>
        </div>
      </div>
    </header>
  );
}
