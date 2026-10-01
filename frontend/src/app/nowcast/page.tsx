'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useLocationContext } from '@/context/LocationContext';
import {
  fetchPrecipitationNowcast,
  PrecipitationNowcastReport,
  RainIntensityCategory,
} from '@/lib/weatherService';

export default function NowcastPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();
  const [report, setReport] = useState<PrecipitationNowcastReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadNowcast = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchPrecipitationNowcast(
          activeLocation.latitude,
          activeLocation.longitude,
          { forceRefresh }
        );
        setReport(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load precipitation nowcast.';
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
        const data = await fetchPrecipitationNowcast(
          activeLocation.latitude,
          activeLocation.longitude
        );
        if (isSubscribed) {
          setReport(data);
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          const msg = err instanceof Error ? err.message : 'Failed to load precipitation nowcast.';
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

  // Helper for intensity styling
  const getIntensityBadgeClass = (category: RainIntensityCategory) => {
    switch (category) {
      case 'dry':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'light':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'moderate':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'heavy':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'violent':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getBarColor = (category: RainIntensityCategory) => {
    switch (category) {
      case 'dry':
        return 'bg-slate-200';
      case 'light':
        return 'bg-sky-400';
      case 'moderate':
        return 'bg-blue-500';
      case 'heavy':
        return 'bg-indigo-600';
      case 'violent':
        return 'bg-purple-600';
      default:
        return 'bg-slate-200';
    }
  };

  // Find maximum rate for bar scaling (minimum baseline 2.0 mm/h)
  const maxRate = report
    ? Math.max(2.0, ...report.steps.map((s) => s.precipitationRateMmH))
    : 2.0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌧️</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Precipitation Nowcast
            </h1>
            <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800 uppercase">
              15-Min Modeling
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Next 120-minute minute-by-minute rain trajectory for{' '}
            <span className="font-semibold text-slate-700">{activeLocation.name}</span> (
            {activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => loadNowcast(true)}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            title="Refresh latest 15-minute forecast"
          >
            <span>🔄</span>
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={openLocationSearch}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
          >
            <span>📍</span>
            <span>Change Location</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs animate-pulse space-y-4">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-lg" />
            ))}
          </div>
          <div className="h-44 bg-slate-100 rounded-lg" />
        </div>
      )}

      {/* Error Card */}
      {error && !isLoading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-800 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <span>⚠️</span>
            <span>Unable to load precipitation nowcast</span>
          </div>
          <p className="text-xs text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => loadNowcast(false)}
            className="mt-2 inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 transition cursor-pointer"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Main Nowcast Presentation */}
      {report && !isLoading && (
        <div className="space-y-5">
          {/* Summary Badges: 4 Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Horizon Badge */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Nowcast Horizon
              </span>
              <p className="text-lg font-bold text-slate-900 mt-1">Next 120 Mins</p>
              <span className="text-[11px] text-slate-500">8 steps (15m interval)</span>
            </div>

            {/* Rain Probability Badge */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Rain Probability
              </span>
              <p
                className={`text-lg font-bold mt-1 ${
                  report.maxProbability > 50
                    ? 'text-sky-600'
                    : report.maxProbability > 20
                    ? 'text-slate-800'
                    : 'text-slate-600'
                }`}
              >
                {report.maxProbability}%
              </p>
              <span className="text-[11px] text-slate-500">Peak 2h probability</span>
            </div>

            {/* Current Intensity Badge */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Current Intensity
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase border ${getIntensityBadgeClass(
                    report.currentIntensityCategory
                  )}`}
                >
                  {report.currentIntensityCategory}
                </span>
                <span className="text-xs font-mono font-semibold text-slate-700">
                  {report.currentIntensityMmH} mm/h
                </span>
              </div>
              <span className="text-[11px] text-slate-500">Active precipitation rate</span>
            </div>

            {/* Total Rain Projection Badge */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                2h Total Volume
              </span>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {report.totalExpectedPrecipitationMm} mm
              </p>
              <span className="text-[11px] text-slate-500">Cumulative expected depth</span>
            </div>
          </div>

          {/* Condition / Trajectory Summary Banner */}
          <div
            className={`rounded-xl border p-4 shadow-xs flex items-center justify-between gap-3 ${
              report.willRain
                ? 'bg-sky-50/80 border-sky-200 text-sky-900'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{report.willRain ? '🌧️' : '☀️'}</span>
              <div>
                <h3 className="text-sm font-bold">
                  {report.willRain ? 'Rain Predicted in Nowcast Window' : 'Dry Window Projected'}
                </h3>
                <p className="text-xs opacity-90 mt-0.5">{report.summaryMessage}</p>
              </div>
            </div>

            <Link
              href="/maps"
              className="shrink-0 text-xs font-semibold underline hover:no-underline px-2 py-1 rounded bg-white/60 hover:bg-white transition"
            >
              Open Live Radar Map →
            </Link>
          </div>

          {/* Bar Projection Chart (Next 120 Minutes) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  15-Minute Rain Intensity Projection (mm/h)
                </h3>
                <p className="text-xs text-slate-500">
                  Projected hourly precipitation rate across 8 intervals
                </p>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <div className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                  <span>Dry</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                  <span>Light (&lt;2.5)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span>Mod (2.5-10)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                  <span>Heavy (10+)</span>
                </div>
              </div>
            </div>

            {/* Vertical Bar Timeline */}
            <div className="pt-4 pb-2">
              <div className="grid grid-cols-8 gap-2 items-end h-44 border-b border-slate-200 px-1 pb-1">
                {report.steps.map((step) => {
                  const heightPercent = Math.min(
                    100,
                    Math.max(6, Math.round((step.precipitationRateMmH / maxRate) * 100))
                  );

                  return (
                    <div
                      key={step.timeIso}
                      className="flex flex-col items-center justify-end h-full group relative"
                    >
                      {/* Metric Hover Tooltip */}
                      <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 text-white rounded px-2 py-1 text-[10px] pointer-events-none whitespace-nowrap shadow-md">
                        <span className="font-semibold">{step.timeFormatted}</span>
                        <span>{step.precipitationRateMmH} mm/h ({step.probability}%)</span>
                      </div>

                      {/* Value label above bar */}
                      <span className="text-[10px] font-mono text-slate-600 mb-1 font-semibold">
                        {step.precipitationRateMmH > 0 ? `${step.precipitationRateMmH}` : '0'}
                      </span>

                      {/* Bar Fill */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[36px] rounded-t-md transition-all duration-300 ${getBarColor(
                          step.intensityCategory
                        )} group-hover:opacity-90`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Labels (Time & Step) */}
              <div className="grid grid-cols-8 gap-2 pt-2 px-1 text-center">
                {report.steps.map((step, idx) => (
                  <div key={step.timeIso} className="flex flex-col items-center">
                    <span className="text-xs font-semibold text-slate-800 font-mono">
                      {step.timeFormatted}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {idx === 0 ? 'Now' : `+${step.minutesFromNow}m`}
                    </span>
                    <span
                      className={`mt-1 text-[10px] font-medium px-1 rounded ${
                        step.probability > 0 ? 'bg-sky-50 text-sky-700' : 'text-slate-400'
                      }`}
                    >
                      {step.probability}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Step Breakdown Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">15-Minute Timeline Breakdown</h3>
              <span className="text-xs text-slate-500">Open-Meteo High-Resolution Forecasting</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Time</th>
                    <th className="py-2.5 px-3">Offset</th>
                    <th className="py-2.5 px-3">Expected (15m)</th>
                    <th className="py-2.5 px-3">Intensity (Rate)</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Probability</th>
                    <th className="py-2.5 px-4">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {report.steps.map((step, idx) => (
                    <tr key={step.timeIso} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                        {step.timeFormatted}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-500">
                        {idx === 0 ? 'Immediate' : `+${step.minutesFromNow} min`}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold">
                        {step.precipitationMm} mm
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        {step.precipitationRateMmH} mm/h
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${getIntensityBadgeClass(
                            step.intensityCategory
                          )}`}
                        >
                          {step.intensityCategory}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-500 rounded-full"
                              style={{ width: `${step.probability}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-700">
                            {step.probability}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 truncate max-w-[150px]">
                        {step.conditionDescription}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
