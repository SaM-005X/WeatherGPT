'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useLocationContext } from '@/context/LocationContext';
import {
  fetchStormData,
  StormReport,
  ConvectiveRisk,
  StormCell,
} from '@/lib/stormService';

export default function StormsPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();
  const [report, setReport] = useState<StormReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadStormData = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchStormData(
          activeLocation.latitude,
          activeLocation.longitude,
          { forceRefresh }
        );
        setReport(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve convective storm data.';
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
        const data = await fetchStormData(
          activeLocation.latitude,
          activeLocation.longitude
        );
        if (isSubscribed) {
          setReport(data);
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve convective storm data.';
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

  const getRiskBadge = (risk: ConvectiveRisk) => {
    switch (risk) {
      case 'Severe':
        return 'bg-purple-600 text-white';
      case 'High':
        return 'bg-rose-600 text-white';
      case 'Moderate':
        return 'bg-amber-500 text-white';
      case 'None':
      default:
        return 'bg-emerald-600 text-white';
    }
  };

  const getRiskMeterColor = (score: number) => {
    if (score >= 75) return 'bg-purple-600';
    if (score >= 50) return 'bg-rose-500';
    if (score >= 25) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Thunderstorm & Convective Tracking
            </h1>
            <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800 uppercase tracking-wider">
              Atmospheric Convection
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time lightning potential index, convective downdrafts, and storm cell vectors for{' '}
            <span className="font-semibold text-slate-700">{activeLocation.name}</span> (
            {activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadStormData(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            title="Refresh storm parameters"
          >
            <span>🔄</span>
            <span>{isRefreshing ? 'Updating…' : 'Refresh'}</span>
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

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-32 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="h-20 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
            <div className="h-20 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
            <div className="h-20 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
            <div className="h-20 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
          </div>
          <div className="h-44 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
        </div>
      )}

      {/* Error Banner */}
      {error && !isLoading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span>
            <span>Convective Tracking Unavailable</span>
          </div>
          <p className="text-xs text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => loadStormData(true)}
            className="mt-2 text-xs font-semibold text-rose-900 underline hover:no-underline cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {!isLoading && !error && report && (
        <>
          {/* Main Convective Status Hero Card */}
          <div
            className={`rounded-xl border p-6 shadow-xs ${
              report.convectiveRisk === 'Severe'
                ? 'border-purple-300 bg-purple-50/80'
                : report.convectiveRisk === 'High'
                ? 'border-rose-300 bg-rose-50/80'
                : report.convectiveRisk === 'Moderate'
                ? 'border-amber-300 bg-amber-50/80'
                : 'border-emerald-300 bg-emerald-50/80'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-4">
                <div
                  className={`h-14 w-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-xs ${
                    report.convectiveRisk === 'Severe'
                      ? 'bg-purple-600 text-white'
                      : report.convectiveRisk === 'High'
                      ? 'bg-rose-600 text-white'
                      : report.convectiveRisk === 'Moderate'
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {report.hasActiveThunderstorm ? '⛈️' : report.convectiveRisk === 'None' ? '☀️' : '⚡'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-900">{report.stormType}</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${getRiskBadge(
                        report.convectiveRisk
                      )}`}
                    >
                      Risk: {report.convectiveRisk}
                    </span>
                    {report.hasActiveThunderstorm && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 font-bold border border-rose-300 animate-pulse">
                        Active Lightning
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Lightning Potential Index:{' '}
                    <span className="font-semibold text-slate-900">{report.lightningPotentialScore}%</span> • Peak
                    Downdrafts: <span className="font-semibold text-slate-900">{report.gustsKmh} km/h</span>
                  </p>
                </div>
              </div>

              {/* Lightning Potential Gauge */}
              <div className="sm:text-right shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  Convective Index
                </span>
                <div className="w-36 sm:w-44 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${getRiskMeterColor(
                      report.lightningPotentialScore
                    )}`}
                    style={{ width: `${Math.max(5, report.lightningPotentialScore)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-slate-500 block mb-1">Convective Gusts</span>
              <p className="text-lg font-bold text-slate-900">{report.gustsKmh} km/h</p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">10m Squall Velocity</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-slate-500 block mb-1">Precipitation Rate</span>
              <p className="text-lg font-bold text-slate-900">{report.precipitationRate.toFixed(1)} mm/h</p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Surface Water Yield</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-slate-500 block mb-1">Atmospheric State</span>
              <p className="text-lg font-bold text-slate-900 truncate">
                {report.hasActiveThunderstorm ? 'Convective Core' : 'Stable Margin'}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Boundary Layer</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-slate-500 block mb-1">Spatial Storm Cells</span>
              <p className="text-lg font-bold text-slate-900">
                {report.stormCells.length > 0 ? `${report.stormCells.length} Tracked` : '0 Active'}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Within 10 km Radius</span>
            </div>
          </div>

          {/* Regional Storm Cells Section (if active) */}
          {report.stormCells.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Regional Convective Storm Cells (Within 10 km)
                </h3>
                <Link
                  href="/maps"
                  className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1"
                >
                  <span>View on Interactive Map</span>
                  <span>→</span>
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {report.stormCells.map((cell: StormCell) => (
                  <div
                    key={cell.id}
                    className="rounded-lg border border-slate-200 p-3 bg-slate-50/60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">⛈️</span>
                      <div>
                        <p className="font-bold text-slate-900">{cell.description}</p>
                        <p className="text-[11px] text-slate-500">
                          {cell.distanceKm} km {cell.directionCardinal} of center
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        cell.intensity === 'severe'
                          ? 'bg-purple-100 text-purple-800'
                          : cell.intensity === 'high'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {cell.intensity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hourly Convective Forecast Horizon */}
          {report.hourlyRisk.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Next 6 Hours Convective Trend
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                {report.hourlyRisk.map((hr, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 space-y-1">
                    <span className="font-semibold text-slate-700 block">{hr.time}</span>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${getRiskBadge(
                        hr.risk
                      )}`}
                    >
                      {hr.risk}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {hr.lightningProbability}% pot.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Safety Guidelines */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Lightning & Severe Convection Safety Protocol</span>
            </h3>
            <ul className="space-y-2 text-xs text-slate-700">
              {report.safetyGuidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-sky-600 font-bold shrink-0 mt-0.5">●</span>
                  <span className="leading-relaxed">{guideline}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation to Alerts & Radar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs pt-2">
            <Link
              href="/alerts"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            >
              <span>⚠️</span>
              <span>View Severe Weather Warnings & Advisories</span>
            </Link>
            <Link
              href="/maps"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 font-semibold text-white shadow-2xs hover:bg-sky-700 transition"
            >
              <span>📡</span>
              <span>Open Doppler Radar & Storm Layer</span>
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
