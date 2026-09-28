import React from 'react';
import { DailyForecast, UnitSystem } from '@/types/weather';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { formatTemperature, getTemperatureSymbol } from '@/lib/temperature';

interface DailyForecastListProps {
  data?: DailyForecast[];
  isLoading?: boolean;
  units?: UnitSystem;
}

export function DailyForecastList({
  data,
  isLoading = false,
  units = 'metric',
}: DailyForecastListProps) {
  const tempSymbol = getTemperatureSymbol(units);

  if (isLoading && (!data || data.length === 0)) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <LoadingSkeleton className="h-5 w-36 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-wider text-slate-500 uppercase">
          7-Day Outlook
        </h3>
        <span className="text-xs text-slate-400 font-normal">Daily Projections</span>
      </div>

      <div className="divide-y divide-slate-100">
        {data.map((day, index) => (
          <div
            key={`${day.date}-${index}`}
            className="flex items-center justify-between py-2.5 transition hover:bg-slate-50/70 px-2 rounded-lg"
          >
            {/* Day / Date */}
            <div className="w-20 sm:w-24">
              <span className="text-sm font-semibold text-slate-800">
                {day.date}
              </span>
            </div>

            {/* Condition Icon & Rain Chance */}
            <div className="flex items-center gap-3 w-28">
              <WeatherIcon condition={day.condition} className="h-5 w-5" />
              {day.precipitationProbability > 0 ? (
                <span className="text-xs font-medium text-sky-700">
                  {day.precipitationProbability}%
                </span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>

            {/* Min / Max Temp Bar */}
            <div className="flex items-center gap-3 text-right">
              <span className="text-sm font-medium text-slate-500">
                {formatTemperature(day.temperatureMin, units)}{tempSymbol}
              </span>
              <div className="hidden sm:block h-1.5 w-16 sm:w-24 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full w-2/3 bg-sky-400 rounded-full mx-auto" />
              </div>
              <span className="text-sm font-bold text-slate-900 w-10 text-right">
                {formatTemperature(day.temperatureMax, units)}{tempSymbol}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
