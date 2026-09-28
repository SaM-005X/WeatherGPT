'use client';

import React from 'react';
import { useLocationContext } from '@/context/LocationContext';

export default function EarthquakesPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌋</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Global Earthquake Tracker</h1>
            <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 uppercase">
              Phase 9 Roadmap
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time seismic activity relative to <span className="font-semibold text-slate-700">{activeLocation.name}</span> ({activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
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
          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
            🌋
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">USGS Live Seismic Feed Integration Ready</h3>
            <p className="text-xs text-slate-500">Scheduled for implementation in Phase 9 via USGS Earthquake Hazards Program GeoJSON</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Data Provider</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">USGS GeoJSON API</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Magnitude Filter</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">M2.5+ / M4.5+ / M6.0+</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Proximity Calculation</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">Distance to {activeLocation.name}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Update Cadence</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">Every 1–5 Minutes</p>
          </div>
        </div>
      </div>
    </main>
  );
}
