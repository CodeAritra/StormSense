import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import MapView from '../components/MapView';
import TimeSlider from '../components/TimeSlider';
import AlertPanel from '../components/AlertPanel';
import StormCellList from '../components/StormCellList';
import ExplainPanel from '../components/ExplainPanel';
import AlertModal from '../components/AlertModal';

export default function Dashboard() {
  const {
    selectedEventId,
    replayState,
    setForecast,
    setIsLoadingForecast,
    setForecastError,
    setAlerts,
    setReplayState,
    leadIndex,
    setLeadIndex,
  } = useStore();

  const currentIndex = replayState?.current_index ?? 12;

  // Fetch forecast and alerts whenever the replay index or event changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingForecast(true);

    api.getForecast(selectedEventId, currentIndex)
      .then((fc) => {
        if (!isCancelled) {
          setForecast(fc);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Forecast error:', err);
          setForecastError(err.message);
        }
      });

    api.getAlerts(selectedEventId, currentIndex)
      .then((alertsList) => {
        if (!isCancelled) {
          setAlerts(alertsList);
        }
      })
      .catch((err) => {
        if (!isCancelled) console.error('Alerts error:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedEventId, currentIndex, setForecast, setAlerts, setIsLoadingForecast, setForecastError]);

  // Keyboard accessibility controls (Spacebar: Play/Pause, Arrows: Slider)
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Ignore if typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        try {
          if (replayState?.playing) {
            const next = await api.pauseReplay();
            setReplayState(next);
          } else {
            const next = await api.resumeReplay();
            setReplayState(next);
          }
        } catch (err) {
          console.error('Key toggle failed:', err);
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setLeadIndex(Math.min(11, leadIndex + 1));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setLeadIndex(Math.max(-1, leadIndex - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replayState, leadIndex, setReplayState, setLeadIndex]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
      {/* Main Workstation View: Left Sidebar + Central Map */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Alerts, Active Cells, Explainability) */}
        <aside className="w-80 lg:w-96 p-3 flex flex-col gap-3 bg-storm-950/80 border-r border-slate-800/80 overflow-y-auto select-none z-10 flex-shrink-0">
          <AlertPanel />
          <StormCellList />
          <ExplainPanel />
        </aside>

        {/* Central Map Workspace */}
        <main className="flex-1 relative bg-slate-950 overflow-hidden">
          <MapView />
        </main>
      </div>

      {/* Bottom Timeline Horizon Slider */}
      <div className="flex-shrink-0 z-20">
        <TimeSlider />
      </div>

      {/* Multilingual Dispatch / Preview Modal */}
      <AlertModal />
    </div>
  );
}
