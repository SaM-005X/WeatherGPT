import React from 'react';
import { HourlyForecast, UnitSystem } from '@/types/weather';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { formatTemperature, getTemperatureSymbol } from '@/lib/temperature';

interface HourlyForecastListProps {
  data?: HourlyForecast[];
  isLoading?: boolean;
  units?: UnitSystem;
}

export function HourlyForecastList({
  data,
  isLoading = false,
  units = 'metric',
}: HourlyForecastListProps) {
  const tempSymbol = getTemperatureSymbol(units);

  if (isLoading && (!data || data.length === 0)) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <LoadingSkeleton className="h-5 w-36 mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-28 w-20 shrink-0 rounded-lg" />
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold tracking-wider text-slate-500 uppercase">
          Today&apos;s Hourly Forecast
        </h3>
        <span className="text-xs text-slate-400 font-normal">24-Hour Horizon</span>
      </div>

      {/* Horizontally scrollable container */}
      <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-200">
        {data.map((item, index) => (
          <div
            key={`${item.time}-${index}`}
            className="flex min-w-[76px] flex-col items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-center transition hover:border-slate-300"
          >
            {/* Hour Time */}
            <span className="text-xs font-medium text-slate-600">
              {item.time}
            </span>

            {/* Condition Icon */}
            <div className="my-2">
              <WeatherIcon condition={item.condition} className="h-6 w-6" />
            </div>

            {/* Converted Temperature */}
            <span className="text-sm font-bold text-slate-900">
              {formatTemperature(item.temperature, units)}{tempSymbol}
            </span>

            {/* Rain Probability */}
            <span className="mt-1 text-[11px] font-medium text-sky-700">
              {item.precipitationProbability > 0 ? `${item.precipitationProbability}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
