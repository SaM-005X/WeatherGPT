'use client';

import React, { useState, useEffect } from 'react';
import { useLocationContext } from '@/context/LocationContext';
import {
  fetchEarthquakes,
  filterEarthquakes,
  Earthquake,
  EarthquakeResponse,
  MagnitudeFilter,
  ScopeFilter,
} from '@/lib/earthquakeService';
import { WeatherMap } from '@/components/map/WeatherMap';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function EarthquakesPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();

  const [data, setData] = useState<EarthquakeResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [magFilter, setMagFilter] = useState<MagnitudeFilter>('m2.5');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('global');

  useEffect(() => {
    let isSubscribed = true;

    fetchEarthquakes(activeLocation.latitude, activeLocation.longitude)
      .then((res) => {
        if (isSubscribed) {
          setData(res);
          setIsLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          setError(err instanceof Error ? err.message : 'Failed to load seismic data');
          setIsLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [activeLocation.latitude, activeLocation.longitude]);

  const filteredQuakes: Earthquake[] = data
    ? filterEarthquakes(data.earthquakes, magFilter, scopeFilter)
    : [];

  const getSeverityBadgeClass = (severity: Earthquake['severity']) => {
    switch (severity) {
      case 'major':
        return 'bg-red-500 text-white';
      case 'strong':
        return 'bg-orange-500 text-white';
      case 'moderate':
        return 'bg-amber-400 text-slate-900';
      case 'minor':
      default:
        return 'bg-emerald-500 text-white';
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📉</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">USGS Live Earthquake Tracker</h1>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 uppercase">
              Live Feed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time global seismic monitoring relative to{' '}
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
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Tracked</span>
          <div className="text-lg font-bold text-slate-900 mt-0.5">
            {isLoading ? <LoadingSkeleton className="h-6 w-12" /> : data?.totalCount ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">Past 24 hours</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Nearest Quake</span>
          <div className="text-base font-bold text-slate-900 mt-0.5 truncate">
            {isLoading ? (
              <LoadingSkeleton className="h-6 w-24" />
            ) : data?.nearestQuake ? (
              `M ${data.nearestQuake.magnitude}`
            ) : (
              'None'
            )}
          </div>
          <span className="text-[10px] text-slate-500">
            {data?.nearestQuake ? `${data.nearestQuake.distanceKm} km (${data.nearestQuake.bearing})` : 'N/A'}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Max Magnitude</span>
          <div className="text-base font-bold text-rose-600 mt-0.5">
            {isLoading ? (
              <LoadingSkeleton className="h-6 w-16" />
            ) : data?.maxMagnitudeQuake ? (
              `M ${data.maxMagnitudeQuake.magnitude}`
            ) : (
              'N/A'
            )}
          </div>
          <span className="text-[10px] text-slate-400 truncate block">
            {data?.maxMagnitudeQuake ? data.maxMagnitudeQuake.place : 'N/A'}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Tsunami Advisories</span>
          <div className="text-base font-bold text-slate-900 mt-0.5">
            {isLoading ? (
              <LoadingSkeleton className="h-6 w-10" />
            ) : (
              data?.earthquakes.filter((q) => q.tsunamiAlert).length ?? 0
            )}
          </div>
          <span className="text-[10px] text-slate-400">USGS / PTWC Flags</span>
        </div>
      </div>

      {/* Map Preview with Seismic Overlay */}
      <WeatherMap
        latitude={activeLocation.latitude}
        longitude={activeLocation.longitude}
        locationName={activeLocation.name}
        className="h-80 w-full"
        showStatusCards={false}
      />

      {/* Controls & Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Magnitude:</span>
            <div className="flex items-center gap-1">
              {(['all', 'm2.5', 'm4.5', 'm6.0'] as MagnitudeFilter[]).map((val) => (
                <button
                  key={val}
                  onClick={() => setMagFilter(val)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer border ${
                    magFilter === val
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {val === 'all' ? 'All M' : val.toUpperCase() + '+'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Scope:</span>
            <div className="flex items-center gap-1">
              {(['local', 'regional', 'global'] as ScopeFilter[]).map((val) => (
                <button
                  key={val}
                  onClick={() => setScopeFilter(val)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer border ${
                    scopeFilter === val
                      ? 'bg-sky-50 border-sky-300 text-sky-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {val === 'local' ? 'Local (<500km)' : val === 'regional' ? 'Regional (<1500km)' : 'Global'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Earthquakes List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wider text-slate-600 uppercase">
            Seismic Events ({filteredQuakes.length})
          </h2>
          {data?.cachedAt && (
            <span className="text-[11px] text-slate-400">
              Updated {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <LoadingSkeleton className="h-16 w-full rounded-xl" />
            <LoadingSkeleton className="h-16 w-full rounded-xl" />
            <LoadingSkeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            ⚠️ {error}
          </div>
        ) : filteredQuakes.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500 shadow-2xs">
            No earthquakes matched the selected magnitude and scope filters.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {filteredQuakes.map((eq) => (
              <a
                key={eq.id}
                href={eq.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-sm shadow-2xs ${getSeverityBadgeClass(
                      eq.severity
                    )}`}
                  >
                    M{eq.magnitude.toFixed(1)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-600 transition">
                      {eq.place}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>Depth: {eq.depth} km</span>
                      <span>•</span>
                      <span>{new Date(eq.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {eq.tsunamiAlert && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-800">
                          🌊 TSUNAMI FLAG
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 text-right">
                  <div>
                    <span className="text-xs font-semibold text-slate-800">
                      {eq.distanceKm} km ({eq.bearing})
                    </span>
                    <span className="block text-[10px] text-slate-400">from {activeLocation.name}</span>
                  </div>
                  <span className="text-slate-400 group-hover:text-slate-600 transition">↗</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
