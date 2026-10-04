'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useLocationContext } from '@/context/LocationContext';
import {
  fetchAstronomyData,
  AstronomyReport,
} from '@/lib/astronomyService';

export default function AstronomyPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();
  const [report, setReport] = useState<AstronomyReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadAstronomy = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchAstronomyData(
          activeLocation.latitude,
          activeLocation.longitude,
          { forceRefresh }
        );
        setReport(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve astronomy data.';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeLocation.latitude, activeLocation.longitude]
  );

  useEffect(() => {
    let isSubscribed = true;

    async function initialFetch() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchAstronomyData(
          activeLocation.latitude,
          activeLocation.longitude
        );
        if (isSubscribed) {
          setReport(data);
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve astronomy data.';
          setError(msg);
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }

    initialFetch();

    return () => {
      isSubscribed = false;
    };
  }, [activeLocation.latitude, activeLocation.longitude]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition flex items-center gap-1"
            >
              <span>←</span>
              <span>Back to Weather</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-amber-600">Solar & Lunar Tracking</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-2xl">☀️</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Sun & Moon Astronomy</h1>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
              Ephemeris Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time solar arc trajectory, daylight hours & synodic lunar phase for{' '}
            <span className="font-semibold text-slate-700">{activeLocation.name}</span> (
            {activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => loadAstronomy(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
            title="Refresh astronomy data"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={openLocationSearch}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
          >
            <span>📍</span>
            <span>Change Location</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="text-base">⚠️</span>
            <div>
              <strong className="font-semibold">Unable to calculate astronomical ephemeris:</strong>
              <div className="mt-0.5 text-rose-700">{error}</div>
            </div>
          </div>
          <button
            onClick={() => loadAstronomy(true)}
            className="rounded bg-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-300 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !report && (
        <div className="space-y-6 animate-pulse">
          <div className="h-64 rounded-2xl border border-slate-200 bg-white p-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 rounded-xl border border-slate-200 bg-white p-6" />
            <div className="h-48 rounded-xl border border-slate-200 bg-white p-6" />
          </div>
        </div>
      )}

      {/* Main Astronomy Dashboard */}
      {report && (
        <>
          {/* Solar Arc Tracking Hero Card */}
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/70 to-white p-6 shadow-xs relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                    Solar Ephemeris
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    Status: <strong className="text-amber-800">{report.solar.solarStatus}</strong>
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1.5">
                  Daylight Arc & Sun Horizon Position
                </h2>
                <div className="text-xs text-slate-600 mt-0.5">
                  Total daylight duration:{' '}
                  <strong className="text-slate-900 font-bold">{report.solar.daylightDurationFormatted}</strong> (
                  {Math.round(report.solar.progressPercent)}% elapsed)
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-amber-200/60 bg-white px-4 py-2.5 text-center shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Solar Noon</div>
                  <div className="text-base font-extrabold text-amber-700 mt-0.5">{report.solar.solarNoonTime}</div>
                  <div className="text-[10px] text-slate-500">Peak Zenith</div>
                </div>

                <div className="rounded-xl border border-amber-200/60 bg-white px-4 py-2.5 text-center shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Solar State</div>
                  <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1 justify-center">
                    <span>{report.solar.isSunUp ? '☀️ Sun Up' : '🌙 Below Horizon'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Local Orbit</div>
                </div>
              </div>
            </div>

            {/* Solar Arc Visual Progress Track */}
            <div className="mt-6 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🌅</span>
                  <div>
                    <div className="text-[10px] text-slate-500 font-medium">Sunrise</div>
                    <div className="font-bold text-slate-900">{report.solar.sunriseTime}</div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">
                    {report.solar.solarStatus === 'Daylight' ? 'Sun In Sky' : report.solar.solarStatus}
                  </div>
                  <div className="text-xs font-bold text-amber-700">{report.solar.progressPercent.toFixed(1)}%</div>
                </div>

                <div className="flex items-center gap-1.5 text-right">
                  <div>
                    <div className="text-[10px] text-slate-500 font-medium">Sunset</div>
                    <div className="font-bold text-slate-900">{report.solar.sunsetTime}</div>
                  </div>
                  <span className="text-base">🌇</span>
                </div>
              </div>

              {/* Arc bar with sun indicator pin */}
              <div className="relative h-3 w-full rounded-full bg-slate-200/80 overflow-visible mt-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 transition-all duration-500"
                  style={{ width: `${report.solar.progressPercent}%` }}
                />
                <div
                  className="absolute -top-1.5 h-6 w-6 -ml-3 rounded-full bg-white border-2 border-amber-500 shadow-md flex items-center justify-center text-xs transition-all duration-500"
                  style={{ left: `${report.solar.progressPercent}%` }}
                  title={`Solar position: ${report.solar.progressPercent}%`}
                >
                  ☀️
                </div>
              </div>

              {/* Golden Hour Markers */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-amber-100">
                <div className="flex items-center justify-between rounded-lg bg-white/70 p-2.5 border border-amber-100/70 text-xs">
                  <span className="text-slate-600">Morning Golden Hour</span>
                  <span className="font-bold text-amber-800">Until {report.solar.goldenHourMorning}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/70 p-2.5 border border-amber-100/70 text-xs">
                  <span className="text-slate-600">Evening Golden Hour</span>
                  <span className="font-bold text-amber-800">From {report.solar.goldenHourEvening}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Lunar Cycle & Moon Phase Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Lunar Phase Card */}
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/60 to-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800 uppercase tracking-wider">
                    Lunar Cycle
                  </span>
                  <span className="text-xs font-semibold text-slate-500">Synodic Month (29.53d)</span>
                </div>

                <div className="mt-4 flex items-center gap-5">
                  <div className="h-20 w-20 rounded-2xl bg-indigo-950 text-white flex items-center justify-center text-4xl shadow-md shadow-indigo-900/20">
                    {report.lunar.emoji}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{report.lunar.phaseName}</h3>
                    <div className="text-xs text-indigo-700 font-semibold mt-0.5">
                      Illumination: <strong className="text-slate-900 font-bold">{report.lunar.illuminationPercent}%</strong>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Lunar age: {report.lunar.ageDays} days into current 29.5-day cycle
                    </div>
                  </div>
                </div>
              </div>

              {/* Illumination Meter */}
              <div className="mt-5 pt-3 border-t border-indigo-100">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
                  <span>Surface Illumination</span>
                  <span className="font-bold text-indigo-900">{report.lunar.illuminationPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600"
                    style={{ width: `${report.lunar.illuminationPercent}%` }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-white p-2.5 border border-indigo-100 shadow-2xs">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Next Full Moon</div>
                    <div className="font-bold text-slate-900 mt-0.5">In {report.lunar.daysUntilNextFullMoon} days</div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-indigo-100 shadow-2xs">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Next New Moon</div>
                    <div className="font-bold text-slate-900 mt-0.5">In {report.lunar.daysUntilNextNewMoon} days</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Astronomical Guide & Stargazing Advice */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔭</span>
                  <h3 className="text-base font-bold text-slate-900">Celestial & Astronomical Notes</h3>
                </div>

                <div className="mt-4 space-y-3 text-xs text-slate-600">
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <strong className="text-slate-900 font-semibold block">Telescope & Stargazing Impact:</strong>
                    {report.lunar.illuminationPercent > 70 ? (
                      <span className="mt-0.5 block leading-relaxed">
                        Bright moonlight ({report.lunar.illuminationPercent}% illumination) washes out faint deep-sky nebulae and galaxies. Excellent for viewing lunar craters along the terminator line.
                      </span>
                    ) : (
                      <span className="mt-0.5 block leading-relaxed">
                        Low lunar illumination ({report.lunar.illuminationPercent}%) produces dark night skies, ideal for observing the Milky Way, star clusters, and deep-space objects.
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <strong className="text-slate-900 font-semibold block">Photography Golden Hours:</strong>
                    <span className="mt-0.5 block leading-relaxed">
                      Plan outdoor landscape shoots between sunrise and {report.solar.goldenHourMorning}, or between {report.solar.goldenHourEvening} and sunset for warm, diffuse natural lighting.
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Astronomical algorithm: Synodic Epoch Math</span>
                <span className="text-emerald-700 font-semibold">Open-Meteo Ephemeris</span>
              </div>
            </div>

          </div>
        </>
      )}
    </main>
  );
}
