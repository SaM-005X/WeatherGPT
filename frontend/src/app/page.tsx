'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WeatherReport } from '@/types/weather';
import { fetchWeatherData, getCacheStatus } from '@/lib/weatherService';
import { useLocationContext } from '@/context/LocationContext';

import { LocationSection } from '@/components/location/LocationSection';
import { CurrentWeatherCard } from '@/components/weather/CurrentWeatherCard';
import { WeatherMap } from '@/components/map/WeatherMap';
import { HourlyForecastList } from '@/components/forecast/HourlyForecastList';
import { DailyForecastList } from '@/components/forecast/DailyForecastList';
import { WeatherAssistant } from '@/components/chatbot/WeatherAssistant';
import { ErrorState } from '@/components/ui/ErrorState';

const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export default function WeatherDashboardPage() {
  // 1. Single Source of Truth for Active Location & Saved Locations from Context
  const {
    activeLocation,
    isLoadingLocation,
    locationError,
    savedLocations,
    requestDeviceLocation,
    setManualLocation,
    resolveLocationQuery,
    clearLocationError,
    units,
  } = useLocationContext();

  // 3. Live Weather Data State
  const [weatherData, setWeatherData] = useState<WeatherReport | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  const weatherDataRef = useRef<WeatherReport | null>(null);
  useEffect(() => {
    weatherDataRef.current = weatherData;
  }, [weatherData]);

  const isFetchingRef = useRef<boolean>(false);
  const lastRefreshTimeRef = useRef<number>(0);

  // 4. Fetch weather whenever coordinates change (cancels previous in-flight requests)
  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    // Async data fetching to synchronize external weather API with component state
    const executeFetch = async () => {
      // If we don't already have cached data for these coordinates, show loading skeleton
      const cacheStatus = getCacheStatus(activeLocation.latitude, activeLocation.longitude);
      if (!cacheStatus.isCached) {
        setIsWeatherLoading(true);
      }

      try {
        const data = await fetchWeatherData(activeLocation.latitude, activeLocation.longitude, {
          signal: controller.signal,
          forceRefresh: false,
        });
        if (!isCancelled) {
          setWeatherData(data);
          setWeatherError(null);
          setRefreshNotice(null);
          setIsWeatherLoading(false);
          const now = Date.now();
          lastRefreshTimeRef.current = now;
          setLastRefreshedAt(now);
        }
      } catch (err: unknown) {
        if (isCancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Unable to retrieve weather data.';
        setWeatherError(message);
        setRefreshNotice(null);
        setIsWeatherLoading(false);
      }
    };

    executeFetch();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [activeLocation.latitude, activeLocation.longitude]);

  // 5. Shared Refresh Weather Handler (bypasses cache for current active location non-destructively)
  const handleRefreshWeather = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);
    setRefreshNotice(null);

    try {
      const data = await fetchWeatherData(activeLocation.latitude, activeLocation.longitude, {
        forceRefresh: true,
      });
      setWeatherData(data);
      const now = Date.now();
      lastRefreshTimeRef.current = now;
      setLastRefreshedAt(now);

      if (data.current.isStale) {
        setRefreshNotice('Notice: Weather provider unreachable. Displaying cached observation.');
      } else {
        setWeatherError(null);
        setRefreshNotice(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to retrieve weather data.';
      if (weatherDataRef.current) {
        setWeatherData((prev) =>
          prev
            ? {
                ...prev,
                current: { ...prev.current, isStale: true },
                cacheMetadata: prev.cacheMetadata
                  ? { ...prev.cacheMetadata, isStale: true, isFresh: false }
                  : undefined,
              }
            : null
        );
        setRefreshNotice(`Weather refresh notice: ${message}. Displaying previous observation.`);
      } else {
        setWeatherError(message);
      }
      lastRefreshTimeRef.current = Date.now();
    } finally {
      isFetchingRef.current = false;
      setIsRefreshing(false);
    }
  }, [activeLocation.latitude, activeLocation.longitude]);

  // 6. Automatic Weather Refresh Lifecycle (every 10 minutes, active-location safe, tab-visibility aware, manual-refresh synchronized)
  useEffect(() => {
    if (lastRefreshTimeRef.current === 0) {
      lastRefreshTimeRef.current = Date.now();
    }

    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastRefreshTimeRef.current;
        if (elapsed >= AUTO_REFRESH_INTERVAL_MS) {
          handleRefreshWeather();
        }
      }
    }, 30 * 1000); // Check every 30 seconds for elapsed interval

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastRefreshTimeRef.current;
        if (elapsed >= AUTO_REFRESH_INTERVAL_MS) {
          handleRefreshWeather();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleRefreshWeather]);

  // 7. Coordinate synchronization check: detects in-flight location change immediately on render
  const activeCoordsId = `coords-${activeLocation.latitude.toFixed(4)}-${activeLocation.longitude.toFixed(4)}`;
  const isWeatherStale = weatherData !== null && weatherData.locationId !== activeCoordsId;
  const isWeatherLoadingEffective = isWeatherLoading || (isWeatherStale && !weatherError);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-900">
      {/* Main Content Area — Strict Visual Hierarchy */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
        
        {/* Status Indicator Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isRefreshing || isWeatherLoadingEffective ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
            <p className="text-xs font-medium text-slate-500">
              Active • {activeLocation.name}
              {(isRefreshing || isWeatherLoadingEffective) && <span className="ml-1 text-slate-400">(Updating...)</span>}
            </p>
          </div>
        </div>

        {/* 1. Location Section (Single Source of Truth) */}
        <div id="location-section">
          <LocationSection
            activeLocation={activeLocation}
            isLoading={isLoadingLocation}
            error={locationError}
            savedLocations={savedLocations}
            onRequestGeolocation={requestDeviceLocation}
            onSelectPreset={setManualLocation}
            onResolveQuery={resolveLocationQuery}
            onDismissError={clearLocationError}
          />
        </div>

        {/* Non-destructive Refresh Error Notice */}
        {refreshNotice && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-amber-600 font-bold">⚠️</span>
              <span>{refreshNotice}</span>
            </div>
            <button
              onClick={() => setRefreshNotice(null)}
              className="text-amber-700 hover:text-amber-900 font-bold ml-2 cursor-pointer"
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
        )}

        {/* Weather Content or Error Display */}
        {weatherError ? (
          <ErrorState
            title="Weather Temporarily Unavailable"
            message={weatherError}
            onRetry={handleRefreshWeather}
          />
        ) : (
          <>
            {/* 2. Current Weather Card (Dynamically converts °C / °F) */}
            <CurrentWeatherCard
              data={weatherData?.current}
              isLoading={isWeatherLoadingEffective}
              isRefreshing={isRefreshing}
              units={units}
              onRefresh={handleRefreshWeather}
              lastRefreshedAt={lastRefreshedAt || weatherData?.fetchedAt || weatherData?.lastUpdated}
            />

            {/* 3. Weather Map (Synchronized with active location, accuracy, source, and cloud cover) */}
            <WeatherMap
              latitude={activeLocation.latitude}
              longitude={activeLocation.longitude}
              locationName={activeLocation.name}
              accuracy={activeLocation.accuracy}
              source={activeLocation.source}
              cloudCover={weatherData?.current?.cloudCover}
              conditionDescription={weatherData?.current?.conditionDescription}
              condition={weatherData?.current?.condition}
            />

            {/* 4. Today's Forecast (Hourly Scroll, converts °C / °F) */}
            <HourlyForecastList
              data={weatherData?.hourly}
              isLoading={isWeatherLoadingEffective}
              units={units}
            />

            {/* 5. Seven-Day Forecast (Daily min/max, converts °C / °F) */}
            <DailyForecastList
              data={weatherData?.daily}
              isLoading={isWeatherLoadingEffective}
              units={units}
            />
          </>
        )}

        {/* 6. Weather Assistant Chatbot */}
        <WeatherAssistant locationName={activeLocation.name} />

      </main>

      {/* Simple Clean Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <p>WeatherGPT • Simple Full-Stack Weather Application</p>
      </footer>
    </div>
  );
}
