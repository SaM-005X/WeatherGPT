'use client';

import React, { useState, useEffect } from 'react';
import { useLocationContext } from '@/context/LocationContext';
import { fetchWeatherData } from '@/lib/weatherService';
import { WeatherReport } from '@/types/weather';
import { HourlyForecastList } from '@/components/forecast/HourlyForecastList';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { formatTemperature, getTemperatureSymbol } from '@/lib/temperature';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function HourlyPage() {
  const { activeLocation, units, openLocationSearch } = useLocationContext();
  const [data, setData] = useState<WeatherReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadHourly = async () => {
      try {
        const res = await fetchWeatherData(activeLocation.latitude, activeLocation.longitude);
        if (!isCancelled) {
          setData(res);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Unable to retrieve hourly forecast.');
          setLoading(false);
        }
      }
    };

    loadHourly();

    return () => {
      isCancelled = true;
    };
  }, [activeLocation.latitude, activeLocation.longitude]);

  const tempSymbol = getTemperatureSymbol(units);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⏱️</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Hourly Forecast</h1>
            <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 uppercase">
              24-Hour Timeline
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hour-by-hour meteorological projections for <span className="font-semibold text-slate-700">{activeLocation.name}</span> ({activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
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

      {/* Hourly Forecast Horizontal Scroll */}
      <HourlyForecastList data={data?.hourly} isLoading={loading} units={units} />

      {/* Detailed Hourly Table */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold tracking-wider text-slate-500 uppercase">
              Detailed Hourly Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Chronological timeline starting from current local hour</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            {error}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-4 sm:grid-cols-5 text-[11px] font-bold text-slate-400 uppercase pb-2 px-2">
              <span>Time</span>
              <span>Condition</span>
              <span className="text-right">Temp</span>
              <span className="text-right">Precip %</span>
              <span className="text-right hidden sm:block">Status</span>
            </div>
            {data?.hourly.map((item, idx) => (
              <div
                key={`${item.time}-${idx}`}
                className="grid grid-cols-4 sm:grid-cols-5 items-center py-2.5 px-2 text-xs transition hover:bg-slate-50 rounded-lg"
              >
                <span className="font-semibold text-slate-700">{item.time}</span>
                <div className="flex items-center gap-2">
                  <WeatherIcon condition={item.condition} className="h-4 w-4" />
                  <span className="text-slate-600 truncate capitalize">{item.condition.toLowerCase().replace('_', ' ')}</span>
                </div>
                <span className="text-right font-bold text-slate-900">
                  {formatTemperature(item.temperature, units)}{tempSymbol}
                </span>
                <span className="text-right font-semibold text-sky-700">
                  {item.precipitationProbability > 0 ? `${item.precipitationProbability}%` : '0%'}
                </span>
                <span className="text-right text-[11px] text-slate-400 hidden sm:block">
                  {item.precipitationProbability > 50 ? 'Rain Likely' : 'Dry'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
