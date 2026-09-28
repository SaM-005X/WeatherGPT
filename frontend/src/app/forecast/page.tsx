'use client';

import React, { useState, useEffect } from 'react';
import { useLocationContext } from '@/context/LocationContext';
import { fetchWeatherData } from '@/lib/weatherService';
import { WeatherReport } from '@/types/weather';
import { DailyForecastList } from '@/components/forecast/DailyForecastList';
import { formatTemperature, getTemperatureSymbol } from '@/lib/temperature';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function ForecastPage() {
  const { activeLocation, units, openLocationSearch } = useLocationContext();
  const [data, setData] = useState<WeatherReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadForecast = async () => {
      try {
        const res = await fetchWeatherData(activeLocation.latitude, activeLocation.longitude);
        if (!isCancelled) {
          setData(res);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Unable to retrieve extended forecast.');
          setLoading(false);
        }
      }
    };

    loadForecast();

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
            <span className="text-xl">📅</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Extended Daily Forecast</h1>
            <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 uppercase">
              Multi-Day Trends
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Comprehensive daily forecast & daylight hours for <span className="font-semibold text-slate-700">{activeLocation.name}</span> ({activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
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

      {/* 7-Day Standard Outlook Component */}
      <DailyForecastList data={data?.daily} isLoading={loading} units={units} />

      {/* Sun & Daylight Alignment Overview */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-semibold tracking-wider text-slate-500 uppercase mb-3">
          Daily Solar Schedule & Precipitation
        </h3>
        
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data?.daily.map((day, idx) => (
              <div
                key={`${day.date}-${idx}`}
                className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <WeatherIcon condition={day.condition} className="h-6 w-6" />
                  <div>
                    <p className="font-semibold text-slate-800">{day.date}</p>
                    <p className="text-[11px] text-slate-500">
                      High: {formatTemperature(day.temperatureMax, units)}{tempSymbol} • Low: {formatTemperature(day.temperatureMin, units)}{tempSymbol}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500 space-y-0.5">
                  {day.sunrise && <p>🌅 {day.sunrise}</p>}
                  {day.sunset && <p>🌇 {day.sunset}</p>}
                  <p className="font-semibold text-sky-700">
                    {day.precipitationProbability > 0 ? `💧 ${day.precipitationProbability}%` : '💧 0%'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
