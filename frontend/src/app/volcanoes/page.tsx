'use client';

import React, { useState, useEffect } from 'react';
import { useLocationContext } from '@/context/LocationContext';
import {
  fetchVolcanoes,
  Volcano,
  VolcanoResponse,
  AviationColorCode,
} from '@/lib/volcanoService';
import { WeatherMap } from '@/components/map/WeatherMap';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function VolcanoesPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();

  const [data, setData] = useState<VolcanoResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOnlyActive, setFilterOnlyActive] = useState<boolean>(false);

  useEffect(() => {
    let isSubscribed = true;

    fetchVolcanoes(activeLocation.latitude, activeLocation.longitude)
      .then((res) => {
        if (isSubscribed) {
          setData(res);
          setIsLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          setError(err instanceof Error ? err.message : 'Failed to load volcano data');
          setIsLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [activeLocation.latitude, activeLocation.longitude]);

  const displayedVolcanoes: Volcano[] = data
    ? filterOnlyActive
      ? data.volcanoes.filter((v) => v.isUnrestOrErupting)
      : data.volcanoes
    : [];

  const getAviationBadgeClass = (code: AviationColorCode) => {
    switch (code) {
      case 'RED':
        return 'bg-red-600 text-white font-bold';
      case 'ORANGE':
        return 'bg-orange-500 text-white font-bold';
      case 'YELLOW':
        return 'bg-amber-400 text-slate-900 font-bold';
      case 'GREEN':
        return 'bg-emerald-500 text-white font-bold';
      case 'UNKNOWN':
      default:
        return 'bg-slate-200 text-slate-700';
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌋</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Volcano Activity & Eruptions</h1>
            <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800 uppercase">
              Smithsonian GVP & USGS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global volcanic activity monitored relative to{' '}
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

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Active Eruptions</span>
          <div className="text-lg font-bold text-red-600 mt-0.5">
            {isLoading ? <LoadingSkeleton className="h-6 w-10" /> : data?.eruptingCount ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">Aviation RED / Active</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Minor Unrest</span>
          <div className="text-lg font-bold text-amber-600 mt-0.5">
            {isLoading ? <LoadingSkeleton className="h-6 w-10" /> : data?.unrestCount ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">ORANGE / YELLOW Alert</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Monitored</span>
          <div className="text-lg font-bold text-slate-900 mt-0.5">
            {isLoading ? <LoadingSkeleton className="h-6 w-10" /> : data?.totalCount ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">GVP / USGS Database</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Nearest Volcano</span>
          <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">
            {isLoading ? (
              <LoadingSkeleton className="h-6 w-20" />
            ) : data?.nearestVolcano ? (
              data.nearestVolcano.name
            ) : (
              'N/A'
            )}
          </div>
          <span className="text-[10px] text-slate-500">
            {data?.nearestVolcano ? `${data.nearestVolcano.distanceKm} km (${data.nearestVolcano.bearing})` : 'N/A'}
          </span>
        </div>
      </div>

      {/* Map Preview */}
      <WeatherMap
        latitude={activeLocation.latitude}
        longitude={activeLocation.longitude}
        locationName={activeLocation.name}
        className="h-80 w-full"
        showStatusCards={false}
      />

      {/* Filter Toggle */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Display Scope:</span>
          <button
            onClick={() => setFilterOnlyActive((prev) => !prev)}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition cursor-pointer border ${
              filterOnlyActive
                ? 'bg-orange-50 border-orange-300 text-orange-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {filterOnlyActive ? 'Showing Active/Unrest Only' : 'Showing All Monitored Volcanoes'}
          </button>
        </div>
        <span className="text-xs text-slate-500">{displayedVolcanoes.length} Volcanoes</span>
      </div>

      {/* Live Volcanoes List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wider text-slate-600 uppercase">
          Volcanic Activity Reports
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            <LoadingSkeleton className="h-20 w-full rounded-xl" />
            <LoadingSkeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            ⚠️ {error}
          </div>
        ) : (
          <div className="grid gap-3">
            {displayedVolcanoes.map((volc) => (
              <div
                key={volc.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 hover:border-slate-300 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">🌋</span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{volc.name}</h4>
                      <p className="text-[11px] text-slate-500">
                        {volc.country} ({volc.region}) • Elevation: {volc.elevationMeters} m
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className={`rounded px-2 py-0.5 text-[10px] uppercase ${getAviationBadgeClass(volc.colorCode)}`}>
                      Aviation {volc.colorCode}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {volc.status}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{volc.details}</p>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                  <span>
                    Distance from {activeLocation.name}:{' '}
                    <strong className="text-slate-700">{volc.distanceKm} km</strong> ({volc.bearing})
                  </span>
                  <span>Updated: Smithsonian GVP</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
