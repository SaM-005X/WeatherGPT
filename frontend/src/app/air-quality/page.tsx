'use client';

import React from 'react';
import { useLocationContext } from '@/context/LocationContext';

export default function AirQualityPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🍃</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Air Quality & Environmental Health</h1>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 uppercase">
              Planned Feature
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time air pollution metrics for <span className="font-semibold text-slate-700">{activeLocation.name}</span> ({activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
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

      {/* Feature Architecture Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            🍃
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Air Quality Index Architecture Ready</h3>
            <p className="text-xs text-slate-500">Coming in a future phase via Open-Meteo Air Quality REST API</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">European AQI</span>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">Good (0–20)</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">US AQI Standard</span>
            <p className="text-lg font-bold text-sky-600 mt-0.5">0–500 Scale</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Particulates</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">PM2.5 & PM10</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs text-slate-500 font-medium">Trace Gases</span>
            <p className="text-sm font-semibold text-slate-800 mt-1">O₃, NO₂, SO₂, CO</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
          This route is synchronized with <strong className="text-slate-800">{activeLocation.name}</strong>. Changing location from any page updates this environmental monitor atomically.
        </p>
      </div>
    </main>
  );
}
