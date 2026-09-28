'use client';

import React from 'react';
import { useLocationContext } from '@/context/LocationContext';

export default function ActivitiesPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏃</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Weather Activities & Lifestyle</h1>
            <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800 uppercase">
              Phase 10 Roadmap
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Outdoor suitability ratings for <span className="font-semibold text-slate-700">{activeLocation.name}</span> ({activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
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
            🏃
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">WeatherGPT Activities Suitability Engine</h3>
            <p className="text-xs text-slate-500">Scheduled for implementation in Phase 10 via multi-variable comfort scoring</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Running & Jogging</span>
            <p className="text-xs text-slate-700 font-semibold mt-1">Heat & Humidity Index</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Cycling & Commuting</span>
            <p className="text-xs text-slate-700 font-semibold mt-1">Wind Gusts & Rain Probability</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Hiking & Stargazing</span>
            <p className="text-xs text-slate-700 font-semibold mt-1">Visibility & Cloud Cover</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Beach & Swimming</span>
            <p className="text-xs text-slate-700 font-semibold mt-1">UV Index & Temperature</p>
          </div>
        </div>
      </div>
    </main>
  );
}
