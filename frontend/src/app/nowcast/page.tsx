'use client';

import React from 'react';
import { useLocationContext } from '@/context/LocationContext';

export default function NowcastPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌧️</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Precipitation Nowcast</h1>
            <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800 uppercase">
              Phase 12 Roadmap
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Minute-by-minute rain trajectory for <span className="font-semibold text-slate-700">{activeLocation.name}</span> ({activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
          </p>
        </div>
        <button
          onClick={openLocationSearch}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
        >
          <span>📍</span>
          <span>Change Location</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-xl">
            🌧️
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Open-Meteo 15-Minute Nowcast Architecture</h3>
            <p className="text-xs text-slate-500">Scheduled for implementation in Phase 12 using minutely_15 precipitation modeling</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Interval</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">15-Minute Steps</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Nowcast Horizon</span>
            <p className="text-sm font-semibold text-sky-600 mt-1">Next 120 Minutes</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Rain Intensity</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">mm/hour Projection</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Cost / Provider</span>
            <p className="text-sm font-semibold text-emerald-600 mt-1">Free / Open-Meteo</p>
          </div>
        </div>
      </div>
    </main>
  );
}
