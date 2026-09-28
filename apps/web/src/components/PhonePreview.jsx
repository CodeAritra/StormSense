import React, { useState } from 'react';
import { Smartphone, Bell, MessageSquare, ShieldCheck } from 'lucide-react';

export default function PhonePreview({ alert }) {
  const [lang, setLang] = useState('en');

  const messages = alert?.messages || {};
  const currentMsg = messages[lang] || messages['en'] || 'Lightning Alert: Stay indoors.';
  const districtName = alert?.district_name || 'District';
  const etaMin = alert?.eta_min || 15;

  const severityColor =
    alert?.severity === 'severe'
      ? 'border-rose-500 bg-rose-950/40 text-rose-300'
      : alert?.severity === 'warning'
      ? 'border-amber-500 bg-amber-950/40 text-amber-300'
      : 'border-yellow-500 bg-yellow-950/40 text-yellow-300';

  return (
    <div className="flex flex-col items-center">
      {/* Language Tabs */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg mb-4 text-xs font-medium">
        <button
          onClick={() => setLang('en')}
          className={`px-3 py-1 rounded-md transition-all ${
            lang === 'en' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          English
        </button>
        <button
          onClick={() => setLang('bn')}
          className={`px-3 py-1 rounded-md transition-all ${
            lang === 'bn' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          বাংলা (Bengali)
        </button>
        <button
          onClick={() => setLang('hi')}
          className={`px-3 py-1 rounded-md transition-all ${
            lang === 'hi' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          हिन्दी (Hindi)
        </button>
      </div>

      {/* Simulated Smartphone Shell */}
      <div className="w-[300px] h-[520px] rounded-[36px] bg-slate-950 border-[6px] border-slate-700 shadow-2xl relative overflow-hidden flex flex-col p-3">
        {/* Phone Speaker Notch */}
        <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
          <div className="w-8 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Phone Status Bar */}
        <div className="flex justify-between items-center px-3 text-[10px] text-slate-400 font-mono mb-4">
          <span>16:42</span>
          <div className="flex items-center gap-1">
            <span>5G</span>
            <span>⚡ 94%</span>
          </div>
        </div>

        {/* Lockscreen / Notifications view */}
        <div className="flex-1 flex flex-col gap-3 px-1 overflow-y-auto">
          {/* Push Notification Card */}
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <div className="w-4 h-4 rounded bg-cyan-500 flex items-center justify-center text-[10px]">
                  ⚡
                </div>
                <span>StormSense Alert</span>
              </div>
              <span className="text-[9px] text-slate-400">Now</span>
            </div>
            <div className="text-[11px] font-bold text-amber-300 mb-0.5">
              {alert?.severity?.toUpperCase()} ALERT: {districtName}
            </div>
            <p className="text-[11px] text-slate-200 leading-snug">
              {currentMsg}
            </p>
          </div>

          {/* SMS App Simulated Card */}
          <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 mt-2">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-2">
              <MessageSquare className="w-3 h-3 text-cyan-400" />
              <span>SMS from: <strong>IMD-ALERT</strong></span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/90 text-slate-100 text-[11px] font-sans leading-relaxed border-l-2 border-cyan-400">
              {currentMsg}
            </div>
            <div className="mt-1 text-right text-[9px] text-slate-500 font-mono">
              {currentMsg.length}/160 chars
            </div>
          </div>
        </div>

        {/* Phone Home Bar */}
        <div className="w-28 h-1 bg-slate-600 rounded-full mx-auto mt-2" />
      </div>
    </div>
  );
}
