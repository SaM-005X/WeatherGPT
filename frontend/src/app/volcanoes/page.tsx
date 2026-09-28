'use client';

import React from 'react';
import { useLocationContext } from '@/context/LocationContext';

export default function VolcanoesPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌋</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Volcano Activity & Eruptions</h1>
            <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800 uppercase">
              Phase 9 Roadmap
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global volcanic activity monitored relative to <span className="font-semibold text-slate-700">{activeLocation.name}</span> ({activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
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
          <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl">
            🌋
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Smithsonian GVP Volcanic Monitoring Ready</h3>
            <p className="text-xs text-slate-500">Scheduled for implementation in Phase 9 via Global Volcanism Program & USGS VHP</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Provider</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">Smithsonian GVP</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Status Codes</span>
            <p className="text-sm font-semibold text-orange-700 mt-1">Aviation Color Codes</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Data Structure</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">Weekly Eruption Reports</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Spatial Sync</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">Map Layer Ready</p>
          </div>
        </div>
      </div>
    </main>
  );
}
