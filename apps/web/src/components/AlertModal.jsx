import React, { useState } from 'react';
import { X, Send, Download, CheckCircle2, ThumbsUp, ThumbsDown, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import PhonePreview from './PhonePreview';

export default function AlertModal() {
  const { activeModalAlert, setActiveModalAlert, setAlerts, alerts, setFeedbackSummary } = useStore();
  const [isApproving, setIsApproving] = useState(false);
  const [approvedState, setApprovedState] = useState(activeModalAlert?.status === 'approved');
  const [sentTimestamp, setSentTimestamp] = useState(activeModalAlert?.approved_at_utc || null);
  const [feedbackGiven, setFeedbackGiven] = useState(null);

  if (!activeModalAlert) return null;

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const updated = await api.approveAlert(activeModalAlert.id);
      setApprovedState(true);
      setSentTimestamp(new Date().toLocaleTimeString());
      
      // Update global alerts list
      setAlerts(alerts.map((a) => (a.id === updated.id ? { ...a, status: 'approved' } : a)));
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleFeedback = async (outcome) => {
    try {
      await api.submitFeedback(activeModalAlert.id, outcome, '');
      setFeedbackGiven(outcome);
      const nextSummary = await api.getFeedbackSummary();
      setFeedbackSummary(nextSummary);
    } catch (err) {
      console.error('Feedback submission failed:', err);
    }
  };

  const capXmlUrl = api.getCapXmlUrl(activeModalAlert.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="glass-panel w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                activeModalAlert.severity === 'severe'
                  ? 'bg-rose-500 animate-ping'
                  : activeModalAlert.severity === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-yellow-500'
              }`}
            />
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Alert Dispatch & Multilingual Preview: {activeModalAlert.district_name}
            </h2>
            <span
              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                activeModalAlert.severity === 'severe'
                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                  : activeModalAlert.severity === 'warning'
                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                  : 'bg-yellow-950 text-yellow-300 border-yellow-800'
              }`}
            >
              {activeModalAlert.severity}
            </span>
          </div>

          <button
            onClick={() => setActiveModalAlert(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left Column: Phone mockup preview */}
          <div>
            <PhonePreview alert={activeModalAlert} />
          </div>

          {/* Right Column: Alert Details & Actions */}
          <div className="flex flex-col gap-5">
            {/* Status Card */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Estimated Time to Impact (ETA):</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  ~{activeModalAlert.eta_min} minutes
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Lightning Peak Probability:</span>
                <span className="font-mono font-bold text-cyan-400 text-sm">
                  {Math.round(activeModalAlert.peak_prob * 100)}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Peak Vertically Integrated Liquid (VIL):</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {activeModalAlert.peak_vil}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800">
                <span className="text-slate-400">Dispatch Status:</span>
                <span
                  className={`font-semibold flex items-center gap-1 ${
                    approvedState ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {approvedState ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sent (Simulated) at {sentTimestamp || '16:42 IST'}</span>
                    </>
                  ) : (
                    <span>Proposed (Pending Forecaster Approval)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5">
              {!approvedState ? (
                <button
                  id="btn-approve-send"
                  disabled={isApproving}
                  onClick={handleApprove}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isApproving ? 'Approving...' : 'Approve & Send Alert'}</span>
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Alert broadcasted to NDMA, State Disaster Management Authority & public channel simulators.</span>
                </div>
              )}

              {/* Download CAP XML Button */}
              <a
                id="btn-download-cap"
                href={capXmlUrl}
                download={`CAP_${activeModalAlert.id}.xml`}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Download Standards-Compliant CAP 1.2 XML</span>
              </a>
            </div>

            {/* Forecaster Feedback Control */}
            {approvedState && (
              <div className="mt-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span>Continuous Feedback Loop (Post-Event Verification):</span>
                  {feedbackGiven && (
                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                      Recorded: {feedbackGiven}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleFeedback('hit')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      feedbackGiven === 'hit'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-emerald-950/40 hover:text-emerald-300 hover:border-emerald-700'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Hit</span>
                  </button>

                  <button
                    onClick={() => handleFeedback('miss')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      feedbackGiven === 'miss'
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-700'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5 text-rose-400" />
                    <span>Miss</span>
                  </button>

                  <button
                    onClick={() => handleFeedback('false_alarm')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      feedbackGiven === 'false_alarm'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-amber-950/40 hover:text-amber-300 hover:border-amber-700'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>False Alarm</span>
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Forecaster verifications are recorded in SQLite and queued for future model fine-tuning.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
