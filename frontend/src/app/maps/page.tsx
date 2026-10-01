'use client';

import React, { useEffect, useState } from 'react';
import { useLocationContext } from '@/context/LocationContext';
import { WeatherMap, MapStatusCards, type LayerState } from '@/components/map/WeatherMap';
import { fetchWeatherData } from '@/lib/weatherService';
import { CurrentWeather } from '@/types/weather';

export default function MapsPage() {
  const { activeLocation, openLocationSearch } = useLocationContext();
  const [currentWeather, setCurrentWeather] = useState<CurrentWeather | null>(null);
  const [activeLayers, setActiveLayers] = useState<LayerState>({
    radar: false,
    wind: false,
    clouds: false,
    satellite: false,
    storms: false,
  });

  useEffect(() => {
    let isSubscribed = true;

    async function loadLocationWeather() {
      try {
        const report = await fetchWeatherData(
          activeLocation.latitude,
          activeLocation.longitude
        );
        if (isSubscribed && report?.current) {
          setCurrentWeather(report.current);
        }
      } catch {
        // Graceful degradation: Map continues to work even if weather fetch fails
        if (isSubscribed) {
          setCurrentWeather(null);
        }
      }
    }

    loadLocationWeather();

    return () => {
      isSubscribed = false;
    };
  }, [activeLocation.latitude, activeLocation.longitude]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🗺️</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Radar & Interactive Weather Maps</h1>
            <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 uppercase">
              Leaflet Spatial Layer
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dynamic spatial visualization centered on <span className="font-semibold text-slate-700">{activeLocation.name}</span> ({activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
          </p>
        </div>
        <button
          onClick={openLocationSearch}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
        >
          <span>📍</span>
          <span>Center on New Location</span>
        </button>
      </div>

      {/* Main Map Presentation */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
          <span>Active GPS Accuracy: ±{activeLocation.accuracy || 100}m</span>
          <span className="rounded bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 border border-emerald-200">
            ● Live Position Synced
          </span>
        </div>

        <WeatherMap
          latitude={activeLocation.latitude}
          longitude={activeLocation.longitude}
          locationName={activeLocation.name}
          accuracy={activeLocation.accuracy}
          source={activeLocation.source}
          cloudCover={currentWeather?.cloudCover}
          conditionDescription={currentWeather?.conditionDescription}
          condition={currentWeather?.condition}
          onLayerStateChange={setActiveLayers}
          className="h-[500px] w-full"
        />

        {/* Cohesive Map Layers Status Bar */}
        <MapStatusCards layers={activeLayers} />
      </div>
    </main>
  );
}
