'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useLocationContext } from '@/context/LocationContext';
import {
  fetchWeatherAlerts,
  AlertsReport,
  WeatherAlert,
  AlertSeverity,
} from '@/lib/alertsService';

export default function AlertsPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();
  const [report, setReport] = useState<AlertsReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedAlertIds, setExpandedAlertIds] = useState<Set<string>>(new Set());

  const loadAlerts = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchWeatherAlerts(
          activeLocation.latitude,
          activeLocation.longitude,
          { forceRefresh }
        );
        setReport(data);
        // Automatically expand the highest severity alert if any exist
        if (data.alerts.length > 0) {
          setExpandedAlertIds(new Set([data.alerts[0].id]));
        } else {
          setExpandedAlertIds(new Set());
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve active weather alerts.';
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
        const data = await fetchWeatherAlerts(
          activeLocation.latitude,
          activeLocation.longitude
        );
        if (isSubscribed) {
          setReport(data);
          if (data.alerts.length > 0) {
            setExpandedAlertIds(new Set([data.alerts[0].id]));
          }
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve active weather alerts.';
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

  const toggleExpand = (id: string) => {
    setExpandedAlertIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getSeverityStyle = (severity: AlertSeverity) => {
    switch (severity) {
      case 'Extreme':
      case 'Severe':
        return {
          card: 'border-rose-300 bg-rose-50/70 hover:border-rose-400',
          badge: 'bg-rose-600 text-white font-bold',
          icon: '🚨',
          text: 'text-rose-950',
          border: 'border-rose-200',
        };
      case 'Moderate':
        return {
          card: 'border-amber-300 bg-amber-50/70 hover:border-amber-400',
          badge: 'bg-amber-500 text-white font-semibold',
          icon: '⚠️',
          text: 'text-amber-950',
          border: 'border-amber-200',
        };
      case 'Minor':
      default:
        return {
          card: 'border-sky-300 bg-sky-50/70 hover:border-sky-400',
          badge: 'bg-sky-600 text-white font-medium',
          icon: 'ℹ️',
          text: 'text-sky-950',
          border: 'border-sky-200',
        };
    }
  };

  const highestSeverity = report?.alerts[0]?.severity;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Severe Weather Alerts</h1>
            <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 uppercase tracking-wider">
              Live Monitoring
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official weather warnings, advisories, and watches for{' '}
            <span className="font-semibold text-slate-700">{activeLocation.name}</span> (
            {activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadAlerts(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            title="Refresh active advisories"
          >
            <span>🔄</span>
            <span>{isRefreshing ? 'Checking…' : 'Refresh'}</span>
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
        <div className="space-y-4">
          <div className="h-24 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
          <div className="h-40 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
          <div className="h-40 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
        </div>
      )}

      {/* Error Banner */}
      {error && !isLoading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span>
            <span>Unable to Retrieve Weather Advisories</span>
          </div>
          <p className="text-xs text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => loadAlerts(true)}
            className="mt-2 text-xs font-semibold text-rose-900 underline hover:no-underline cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {!isLoading && !error && report && (
        <>
          {/* Status Summary Banner */}
          {report.alerts.length === 0 ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-2xl shrink-0 shadow-xs">
                  ✓
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-emerald-950">No Active Weather Advisories</h2>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    No severe thunderstorm, gale, extreme temperature, or flooding warnings active for this geographic sector.
                  </p>
                </div>
              </div>
              <div className="text-xs text-emerald-700 sm:text-right shrink-0">
                <p className="font-semibold">Monitored Sources</p>
                <p className="text-[11px] text-emerald-600">NOAA NWS & Synoptic Network</p>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-xl border p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                highestSeverity === 'Extreme' || highestSeverity === 'Severe'
                  ? 'border-rose-400 bg-rose-100/70'
                  : 'border-amber-400 bg-amber-100/70'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-xs ${
                    highestSeverity === 'Extreme' || highestSeverity === 'Severe'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  ⚠️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {report.alerts.length} Active Weather {report.alerts.length === 1 ? 'Advisory' : 'Advisories'}
                    </h2>
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  </div>
                  <p className="text-xs text-slate-700 mt-0.5">
                    Maximum Severity:{' '}
                    <span className="font-bold uppercase tracking-wider">{highestSeverity}</span> • Review protective
                    instructions below.
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 sm:text-right shrink-0">
                <span className="inline-block rounded-md bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-800 border border-slate-200">
                  Last Checked: {new Date(report.fetchedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}

          {/* Active Alerts List */}
          {report.alerts.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-500">
                Active Meteorological Notices
              </h2>

              <div className="space-y-3">
                {report.alerts.map((alert: WeatherAlert) => {
                  const style = getSeverityStyle(alert.severity);
                  const isExpanded = expandedAlertIds.has(alert.id);

                  return (
                    <article
                      key={alert.id}
                      className={`rounded-xl border p-4 sm:p-5 transition shadow-xs ${style.card}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-black/5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">{style.icon}</span>
                          <h3 className={`text-base font-bold ${style.text}`}>{alert.event}</h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${style.badge}`}>
                            {alert.severity}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200/80 text-slate-800 font-medium">
                            Urgency: {alert.urgency}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-600 font-mono">
                          Expires: {new Date(alert.expires).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>

                      {/* Headline */}
                      <p className="text-sm font-semibold text-slate-800 mt-2.5">{alert.headline}</p>

                      {/* Expandable Details Drawer */}
                      {isExpanded ? (
                        <div className="mt-3.5 pt-3 border-t border-black/5 space-y-3 text-xs text-slate-700 animate-in fade-in duration-150">
                          {alert.instruction && (
                            <div className="rounded-lg bg-white/80 p-3 border border-slate-200/80 space-y-1">
                              <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                                <span>🛡️</span>
                                <span>Protective Instructions:</span>
                              </span>
                              <p className="leading-relaxed text-slate-800">{alert.instruction}</p>
                            </div>
                          )}

                          <div className="space-y-1">
                            <span className="font-semibold text-slate-900 block">Meteorological Description:</span>
                            <p className="leading-relaxed whitespace-pre-line text-slate-700">{alert.description}</p>
                          </div>

                          {alert.areaDesc && (
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-900 block">Affected Geographic Sector:</span>
                              <p className="text-slate-600">{alert.areaDesc}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/50">
                            <span>Origin: {alert.source}</span>
                            <span>Advisory ID: {alert.id}</span>
                          </div>
                        </div>
                      ) : null}

                      {/* Toggle Details Button */}
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => toggleExpand(alert.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-800 hover:text-sky-950 transition cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide Details' : 'View Safety Instructions & Details'}</span>
                          <span>{isExpanded ? '▲' : '▼'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Quick Links & Emergency Readiness */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Emergency Preparedness Resources
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <Link
                href="/storms"
                className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition block"
              >
                <span className="text-base block mb-1">⚡</span>
                <span className="font-semibold text-slate-900 block">Convective & Storms</span>
                <span className="text-slate-500 text-[11px] mt-0.5 block">
                  Track atmospheric lightning potential and storm cells.
                </span>
              </Link>
              <Link
                href="/nowcast"
                className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition block"
              >
                <span className="text-base block mb-1">🌧️</span>
                <span className="font-semibold text-slate-900 block">15-Min Rain Nowcast</span>
                <span className="text-slate-500 text-[11px] mt-0.5 block">
                  Minute-by-minute precipitation onset modeling.
                </span>
              </Link>
              <Link
                href="/maps"
                className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition block"
              >
                <span className="text-base block mb-1">📡</span>
                <span className="font-semibold text-slate-900 block">Live Doppler Radar</span>
                <span className="text-slate-500 text-[11px] mt-0.5 block">
                  Spatial reflectivity and storm movement vectors.
                </span>
              </Link>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
