import React from 'react';
import { CurrentWeather, UnitSystem } from '@/types/weather';
import { WeatherIcon } from './WeatherIcon';
import { WeatherCardSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatTemperature, getTemperatureSymbol, formatWindSpeed } from '@/lib/temperature';

interface CurrentWeatherCardProps {
  data?: CurrentWeather;
  isLoading?: boolean;
  isRefreshing?: boolean;
  units?: UnitSystem;
  onRefresh?: () => void;
  lastRefreshedAt?: string | number;
}

export function CurrentWeatherCard({
  data,
  isLoading = false,
  isRefreshing = false,
  units = 'metric',
  onRefresh,
  lastRefreshedAt,
}: CurrentWeatherCardProps) {
  // Only show skeleton on initial load or location switch when there is NO previous data
  if (isLoading && !data) {
    return <WeatherCardSkeleton />;
  }

  if (!data) {
    return <EmptyState title="No Current Weather" message="Awaiting weather observations for the selected location." />;
  }

  const tempSymbol = getTemperatureSymbol(units);
  const formattedTemp = formatTemperature(data.temperature, units);
  const formattedFeelsLike = formatTemperature(data.feelsLike, units);
  const formattedWind = formatWindSpeed(data.windSpeed, units);

  // Format wind direction to compass bearing
  const getWindDirectionLabel = (deg: number): string => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(deg / 45) % 8];
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      {/* Top Header: Condition & Last Updated */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <WeatherIcon condition={data.condition} className="h-8 w-8" />
          <div>
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Current Conditions
            </span>
            <p className="text-base font-semibold text-slate-900">
              {data.conditionDescription}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            {isRefreshing && (
              <span className="text-xs text-sky-600 animate-pulse font-medium">
                Updating...
              </span>
            )}
            {data.isStale && !isRefreshing && (
              <span
                className="text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                title="Observation is past the 5-minute freshness window and current update could not be completed"
              >
                • Stale
              </span>
            )}
            <span
              suppressHydrationWarning
              className="text-xs text-slate-500"
              title={`Provider observation recorded: ${new Date(data.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            >
              {lastRefreshedAt
                ? `Refreshed at ${new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : `Recorded at ${new Date(data.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading || isRefreshing}
              className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-sky-600 hover:bg-sky-50 hover:text-sky-700 transition cursor-pointer disabled:opacity-50"
              title="Refresh Weather"
              aria-label="Refresh Weather"
            >
              <span className={`text-sm ${isRefreshing ? 'animate-spin inline-block' : ''}`}>↻</span>
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Temperature Hero */}
      <div className="my-6 flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-6xl font-extrabold tracking-tight text-slate-900">
            {formattedTemp}
          </span>
          <span className="text-3xl font-light text-slate-400">
            {tempSymbol}
          </span>
        </div>
        <div className="text-sm text-slate-500">
          Feels like{' '}
          <span className="font-semibold text-slate-800">
            {formattedFeelsLike}{tempSymbol}
          </span>
        </div>
      </div>

      {/* Detailed Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
        {/* Humidity */}
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium">Humidity</span>
          <span className="text-base font-semibold text-slate-900 mt-0.5">
            {data.humidity}%
          </span>
        </div>

        {/* Wind Speed & Direction */}
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium">Wind</span>
          <span className="text-base font-semibold text-slate-900 mt-0.5">
            {formattedWind} ({getWindDirectionLabel(data.windDirection)})
          </span>
        </div>

        {/* Precipitation */}
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium">Precipitation</span>
          <span className="text-base font-semibold text-slate-900 mt-0.5">
            {data.precipitation !== undefined ? `${data.precipitation} mm` : '0 mm'}
          </span>
        </div>

        {/* UV Index */}
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium">UV Index</span>
          <span className="text-base font-semibold text-slate-900 mt-0.5">
            {data.uvIndex !== undefined ? data.uvIndex : 'Moderate'}
          </span>
        </div>
      </div>
    </article>
  );
}
