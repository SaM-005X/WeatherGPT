'use client';

import React, { useState, useEffect } from 'react';
import { useLocationContext } from '@/context/LocationContext';
import {
  fetchTsunamiAdvisories,
  TsunamiResponse,
  TsunamiStatusLevel,
} from '@/lib/tsunamiService';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function TsunamisPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();

  const [data, setData] = useState<TsunamiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    fetchTsunamiAdvisories()
      .then((res) => {
        if (isSubscribed) {
          setData(res);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          setError(err instanceof Error ? err.message : 'Failed to load tsunami data');
          setIsLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const getStatusBannerClass = (status: TsunamiStatusLevel) => {
    switch (status) {
      case 'WARNING':
        return 'bg-red-600 text-white border-red-700';
      case 'ADVISORY':
        return 'bg-amber-500 text-white border-amber-600';
      case 'WATCH':
        return 'bg-orange-500 text-white border-orange-600';
      case 'INFORMATION':
        return 'bg-sky-600 text-white border-sky-700';
      case 'NO_ACTIVE':
      default:
        return 'bg-emerald-600 text-white border-emerald-700';
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌊</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">NOAA / PTWC Tsunami Advisories</h1>
            <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800 uppercase">
              Ocean Monitoring
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global coastal tsunami warning network monitoring for{' '}
            <span className="font-semibold text-slate-700">{activeLocation.name}</span> (
            {activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
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

      {/* Tsunami Status Banner */}
      {isLoading ? (
        <LoadingSkeleton className="h-24 w-full rounded-2xl" />
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          ⚠️ {error}
        </div>
      ) : (
        <div
          className={`rounded-2xl border p-5 shadow-xs transition ${getStatusBannerClass(
            data?.maxStatusLevel ?? 'NO_ACTIVE'
          )}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌊</span>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-90">
                Official Ocean Tsunami Status
              </span>
              <h2 className="text-lg font-extrabold tracking-tight mt-0.5">
                {data?.globalStatusText}
              </h2>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Coastal Safety Guidelines */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <span className="text-base">🛡️</span>
          <h3 className="text-sm font-bold text-slate-900">Official Coastal Tsunami Safety Guidelines</h3>
        </div>

        <ul className="space-y-2 text-xs text-slate-700">
          {data?.safetyGuidelines.map((guide, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="text-sky-600 font-bold shrink-0">✓</span>
              <span>{guide}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Active Advisories List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wider text-slate-600 uppercase">
          Active Bulletins ({data?.advisories.length ?? 0})
        </h2>

        {isLoading ? (
          <LoadingSkeleton className="h-20 w-full rounded-xl" />
        ) : !data || data.advisories.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500 shadow-2xs space-y-1">
            <span className="text-xl block">✅</span>
            <p className="font-semibold text-slate-800 text-sm">No Active Tsunami Advisories</p>
            <p className="text-slate-500">
              Pacific Tsunami Warning Center (PTWC) & National Tsunami Warning Center (NTWC) report normal sea-level conditions.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {data.advisories.map((adv) => (
              <div
                key={adv.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-sm font-bold text-slate-900">{adv.title}</h4>
                  <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase">
                    {adv.status}
                  </span>
                </div>
                <p className="text-xs text-slate-700">{adv.summary}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Basins: {adv.affectedBasins.join(', ')}</span>
                  <span>Issued: {new Date(adv.issuedAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
