'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useLocationContext } from '@/context/LocationContext';
import {
  fetchActivitySuitability,
  ActivityEvaluationReport,
  ActivityRatingTier,
} from '@/lib/activityService';

export default function ActivitiesPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();
  const [report, setReport] = useState<ActivityEvaluationReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'top' | 'day' | 'night'>('all');

  const loadActivities = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchActivitySuitability(
          activeLocation.latitude,
          activeLocation.longitude,
          { forceRefresh }
        );
        setReport(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve outdoor activities data.';
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
        const data = await fetchActivitySuitability(
          activeLocation.latitude,
          activeLocation.longitude
        );
        if (isSubscribed) {
          setReport(data);
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve outdoor activities data.';
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

  const getTierBadgeStyles = (tier: ActivityRatingTier) => {
    switch (tier) {
      case 'Ideal':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Good':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'Fair':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Poor':
      default:
        return 'bg-rose-100 text-rose-800 border-rose-300';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-sky-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-rose-600';
  };

  const filteredActivities = report?.activityList.filter((act) => {
    if (activeFilter === 'top') return act.tier === 'Ideal' || act.tier === 'Good';
    if (activeFilter === 'night') return act.id === 'stargazing';
    if (activeFilter === 'day') return act.id !== 'stargazing';
    return true;
  }) || [];

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
            <span className="text-xs font-semibold text-sky-600">Lifestyle Intelligence</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-2xl">🏃</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Weather Activity Suitability</h1>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 uppercase tracking-wider">
              Scoring Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Personalized outdoor suitability scores (0–100) based on live meteorological comfort metrics for{' '}
            <span className="font-semibold text-slate-700">{activeLocation.name}</span> (
            {activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => loadActivities(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
            title="Refresh activity scoring"
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
              <strong className="font-semibold">Unable to calculate activity comfort:</strong>
              <div className="mt-0.5 text-rose-700">{error}</div>
            </div>
          </div>
          <button
            onClick={() => loadActivities(true)}
            className="rounded bg-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-300 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !report && (
        <div className="space-y-6 animate-pulse">
          <div className="h-44 rounded-2xl border border-slate-200 bg-white p-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-56 rounded-xl border border-slate-200 bg-white p-4" />
            ))}
          </div>
        </div>
      )}

      {/* Main Dashboard */}
      {report && (
        <>
          {/* Top Hero: Best Activity Recommendation */}
          <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-50/50 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 rounded-2xl bg-sky-600 text-white flex items-center justify-center text-4xl shadow-md shadow-sky-600/20">
                {report.bestActivity.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sky-200/80 px-2.5 py-0.5 text-[10px] font-bold text-sky-900 uppercase tracking-wider">
                    Top Pick Right Now
                  </span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getTierBadgeStyles(report.bestActivity.tier)}`}>
                    {report.bestActivity.tier} Rating
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {report.bestActivity.name}
                </h2>
                <div className="text-xs text-slate-600 mt-0.5 max-w-lg">
                  {report.bestActivity.summary}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
              <div className="text-center">
                <div className="text-[10px] font-semibold text-slate-500 uppercase">Suitability</div>
                <div className={`text-4xl font-black ${getScoreColor(report.bestActivity.score)} mt-0.5`}>
                  {report.bestActivity.score}
                </div>
                <div className="text-[10px] text-slate-500">out of 100</div>
              </div>
            </div>
          </div>

          {/* Meteorological Metrics Context Strip */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Current Microclimate Parameters
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-slate-500">Temperature</span>
                <div className="text-sm font-bold text-slate-900">{report.metrics.tempC}°C</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-slate-500">Precipitation</span>
                <div className="text-sm font-bold text-slate-900">{report.metrics.precipitationMm} mm/h</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-slate-500">Wind Speed</span>
                <div className="text-sm font-bold text-slate-900">{report.metrics.windSpeedKmh} km/h</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-slate-500">Cloud Cover</span>
                <div className="text-sm font-bold text-slate-900">{report.metrics.cloudCoverPercent}%</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-slate-500">Humidity</span>
                <div className="text-sm font-bold text-slate-900">{report.metrics.humidityPercent}%</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <span className="text-[10px] text-slate-500">Solar State</span>
                <div className="text-sm font-bold text-slate-900">
                  {report.metrics.isDaylight ? '☀️ Daylight' : '🌙 Night'}
                </div>
              </div>
            </div>
          </div>

          {/* Activity Cards Filter Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveFilter('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Activities ({report.activityList.length})
              </button>
              <button
                onClick={() => setActiveFilter('top')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeFilter === 'top'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Recommended Only
              </button>
              <button
                onClick={() => setActiveFilter('day')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeFilter === 'day'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Daytime Sports
              </button>
              <button
                onClick={() => setActiveFilter('night')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeFilter === 'night'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Night Stargazing
              </button>
            </div>
          </div>

          {/* Activity Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredActivities.map((act) => (
              <div
                key={act.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{act.icon}</span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{act.name}</h3>
                        <div className="text-[11px] text-slate-500">Ideal: {act.idealConditions}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getTierBadgeStyles(act.tier)}`}>
                        {act.tier}
                      </span>
                      <div className={`text-2xl font-black mt-1 ${getScoreColor(act.score)}`}>
                        {act.score}<span className="text-xs font-medium text-slate-400">/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {act.summary}
                  </div>

                  {/* Positive & Negative Drivers */}
                  <div className="mt-3 space-y-1.5">
                    {act.positiveDrivers.map((driver, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[11px] text-emerald-800">
                        <span className="text-xs leading-none mt-0.5">✅</span>
                        <span className="leading-snug">{driver}</span>
                      </div>
                    ))}
                    {act.negativeDrivers.map((driver, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[11px] text-rose-800">
                        <span className="text-xs leading-none mt-0.5">⚠️</span>
                        <span className="leading-snug">{driver}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Dynamic Multi-Variable Comfort Scoring</span>
                  <span className="font-semibold text-slate-700">Open-Meteo Synoptic</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
