'use client';

import React from 'react';
import { useLocationContext } from '@/context/LocationContext';

export default function StormsPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌀</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Tropical Cyclone & Hurricane Tracker</h1>
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800 uppercase">
              Phase 12 Roadmap
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Active tropical depressions, storms, and hurricanes monitored relative to <span className="font-semibold text-slate-700">{activeLocation.name}</span>
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
          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
            🌀
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">NOAA NHC & JTWC Cyclone Tracking</h3>
            <p className="text-xs text-slate-500">Scheduled for implementation in Phase 12 via National Hurricane Center GIS feeds</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Atlantic & Pacific</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">NOAA NHC Feeds</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Indian Ocean</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">JTWC / IMD Tracking</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Forecast Cone</span>
            <p className="text-sm font-semibold text-indigo-700 mt-1">5-Day Track Geometry</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Intensity Scale</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">Saffir-Simpson Scale</p>
          </div>
        </div>
      </div>
    </main>
  );
}
