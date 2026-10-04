'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useLocationContext } from '@/context/LocationContext';
import {
  fetchAirQuality,
  AirQualityReport,
  UsAqiCategory,
} from '@/lib/airQualityService';

export default function AirQualityPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();
  const [report, setReport] = useState<AirQualityReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadAirQuality = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchAirQuality(
          activeLocation.latitude,
          activeLocation.longitude,
          { forceRefresh }
        );
        setReport(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve air quality data.';
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
        const data = await fetchAirQuality(
          activeLocation.latitude,
          activeLocation.longitude
        );
        if (isSubscribed) {
          setReport(data);
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve air quality data.';
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

  // Color mappings for US AQI categories
  const getCategoryStyles = (category: UsAqiCategory) => {
    switch (category) {
      case 'Good':
        return {
          bg: 'bg-emerald-500',
          lightBg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-700',
          badgeBg: 'bg-emerald-100',
          ring: 'ring-emerald-500/20',
        };
      case 'Moderate':
        return {
          bg: 'bg-amber-500',
          lightBg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
          badgeBg: 'bg-amber-100',
          ring: 'ring-amber-500/20',
        };
      case 'Sensitive':
        return {
          bg: 'bg-orange-500',
          lightBg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-700',
          badgeBg: 'bg-orange-100',
          ring: 'ring-orange-500/20',
        };
      case 'Unhealthy':
        return {
          bg: 'bg-rose-500',
          lightBg: 'bg-rose-50',
          border: 'border-rose-200',
          text: 'text-rose-700',
          badgeBg: 'bg-rose-100',
          ring: 'ring-rose-500/20',
        };
      case 'Hazardous':
      default:
        return {
          bg: 'bg-purple-600',
          lightBg: 'bg-purple-50',
          border: 'border-purple-200',
          text: 'text-purple-700',
          badgeBg: 'bg-purple-100',
          ring: 'ring-purple-500/20',
        };
    }
  };

  const getPollutantStatusBadge = (category: 'Good' | 'Moderate' | 'Unhealthy' | 'Hazardous') => {
    switch (category) {
      case 'Good':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Moderate':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Unhealthy':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Hazardous':
        return 'bg-purple-100 text-purple-800 border-purple-200';
    }
  };

  const styles = report ? getCategoryStyles(report.category) : getCategoryStyles('Good');

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 space-y-6">
      {/* Navigation Breadcrumb & Header */}
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
            <span className="text-xs font-semibold text-sky-600">Environmental Intelligence</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-2xl">🍃</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Air Quality & Pollution Monitor</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
              Live Feed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time atmospheric pollutants & EPA health advisories for{' '}
            <span className="font-semibold text-slate-700">{activeLocation.name}</span> (
            {activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => loadAirQuality(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
            title="Refresh air quality data"
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

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="text-base">⚠️</span>
            <div>
              <strong className="font-semibold">Unable to update air quality data:</strong>
              <div className="mt-0.5 text-rose-700">{error}</div>
            </div>
          </div>
          <button
            onClick={() => loadAirQuality(true)}
            className="rounded bg-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-300 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !report && (
        <div className="space-y-6 animate-pulse">
          <div className="rounded-xl border border-slate-200 bg-white p-6 h-56" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 rounded-xl border border-slate-200 bg-white p-4" />
            ))}
          </div>
        </div>
      )}

      {/* Main AQI Dashboard */}
      {report && (
        <>
          {/* Primary Score Card */}
          <div className={`rounded-2xl border ${styles.border} ${styles.lightBg} p-6 shadow-xs relative overflow-hidden`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              
              {/* Left: US AQI Big Gauge */}
              <div className="flex items-center gap-5">
                <div className={`h-24 w-24 rounded-2xl ${styles.bg} text-white flex flex-col items-center justify-center shadow-md shadow-slate-300/40`}>
                  <span className="text-xs uppercase font-bold tracking-widest opacity-85">US AQI</span>
                  <span className="text-3xl font-extrabold tracking-tight mt-0.5">{report.usAqi}</span>
                  <span className="text-[10px] font-medium opacity-90">0–500</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${styles.badgeBg} ${styles.text}`}>
                      {report.categoryLabel}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      Dominant: <strong className="text-slate-800">{report.dominantPollutant}</strong>
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 mt-1.5">
                    Atmospheric Condition: {report.category}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5 max-w-md">
                    {report.healthAdvisory.general}
                  </p>
                </div>
              </div>

              {/* Right: Comparative Indices & European Standard */}
              <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200/80 pt-4 md:pt-0 md:pl-6">
                <div className="rounded-xl bg-white/90 border border-slate-200 p-3.5 min-w-[130px] shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">European AQI</div>
                  <div className="text-2xl font-bold text-slate-900 mt-0.5">{report.europeanAqi}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Scale: 0–100+</div>
                </div>

                <div className="rounded-xl bg-white/90 border border-slate-200 p-3.5 min-w-[130px] shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Data Freshness</div>
                  <div className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live 5m TTL</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Open-Meteo Air API</div>
                </div>
              </div>
            </div>

            {/* Health Advisories Accordion Grid */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-200/80 pt-4">
              <div className="rounded-xl bg-white/80 p-3.5 border border-slate-200/60">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <span>🛡️</span>
                  <span>Sensitive Groups & At-Risk Advice</span>
                </div>
                <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {report.healthAdvisory.sensitiveGroups}
                </div>
              </div>

              <div className="rounded-xl bg-white/80 p-3.5 border border-slate-200/60">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <span>🏃</span>
                  <span>Outdoor Recreation & Activities</span>
                </div>
                <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {report.healthAdvisory.outdoorActivities}
                </div>
              </div>
            </div>

            {/* EPA AQI Spectrum Bar */}
            <div className="mt-4 pt-3 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1">
                <span>0 (Good)</span>
                <span>50</span>
                <span>100 (Moderate)</span>
                <span>150 (Sensitive)</span>
                <span>200 (Unhealthy)</span>
                <span>300+ (Hazardous)</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 via-orange-500 via-rose-500 to-purple-700 relative overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 w-1.5 bg-slate-900 border border-white shadow-xs"
                  style={{
                    left: `${Math.min(100, Math.max(0, (report.usAqi / 300) * 100))}%`,
                  }}
                  title={`Current AQI: ${report.usAqi}`}
                />
              </div>
            </div>
          </div>

          {/* Pollutant Breakdown Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧪</span>
                <h3 className="text-base font-bold text-slate-900">Atmospheric Pollutants Breakdown</h3>
              </div>
              <span className="text-xs text-slate-500">Continuous surface sensor observations</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(report.pollutants).map((pollutant) => {
                const badgeClass = getPollutantStatusBadge(pollutant.category);
                return (
                  <div
                    key={pollutant.code}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-900">{pollutant.name}</span>
                          <div className="text-[11px] text-slate-500 uppercase tracking-wider">{pollutant.code.toUpperCase()}</div>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
                          {pollutant.category}
                        </span>
                      </div>

                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-2xl font-extrabold text-slate-900">{pollutant.value}</span>
                        <span className="text-xs font-semibold text-slate-500">{pollutant.unit}</span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-600 leading-snug">
                      {pollutant.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
