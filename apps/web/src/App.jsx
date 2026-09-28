import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { api } from './api/client';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Metrics from './pages/Metrics';
import HonestyBadge from './components/HonestyBadge';

export default function App() {
  const {
    setEvents,
    setReplayState,
    setFeedbackSummary,
    currentPage,
  } = useStore();

  // Initial Data & WebSocket Lifecycle
  useEffect(() => {
    // 1. Fetch available events
    api.getEvents()
      .then((evts) => {
        if (evts && evts.length > 0) {
          setEvents(evts);
        }
      })
      .catch((err) => console.error('Events load error:', err));

    // 2. Fetch feedback summary
    api.getFeedbackSummary()
      .then((summary) => setFeedbackSummary(summary))
      .catch((err) => console.error('Feedback summary error:', err));

    // 3. Connect to live Replay WebSocket
    const closeWs = api.createReplayWebSocket(
      (state) => {
        setReplayState(state);
      },
      (err) => {
        // Fallback polling if WS is disconnected
        api.getReplayState()
          .then((state) => setReplayState(state))
          .catch(() => {});
      }
    );

    return () => {
      closeWs();
    };
  }, [setEvents, setReplayState, setFeedbackSummary]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-storm-950 font-sans">
      {/* Top Application Header */}
      <Header />

      {/* Main Page Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentPage === 'dashboard' ? <Dashboard /> : <Metrics />}
      </div>

      {/* Bottom Transparency & Feedback Footer Strip */}
      <HonestyBadge />
    </div>
  );
}
