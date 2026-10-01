'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import type { LayerState } from './WeatherMapInternal';
import type { WeatherReport } from '@/types/weather';

export type { LayerState };

export interface WeatherMapProps {
  latitude: number;
  longitude: number;
  locationName?: string;
  accuracy?: number;
  source?: 'device' | 'manual';
  className?: string;
  cloudCover?: number;
  conditionDescription?: string;
  condition?: string;
  weatherData?: WeatherReport | null;
  isLoading?: boolean;
  onLayerStateChange?: (layers: LayerState) => void;
  showStatusCards?: boolean;
}

// Dynamically import Leaflet component with SSR disabled
const WeatherMapInternal = dynamic(() => import('./WeatherMapInternal'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-slate-100">
      <div className="flex flex-col items-center gap-2">
        <LoadingSkeleton className="h-6 w-6 rounded-full" />
        <span className="text-xs text-slate-500">Loading map...</span>
      </div>
    </div>
  ),
});

export function MapStatusCards({ layers }: { layers: LayerState }) {
  return (
    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-xs">
      {/* Base Map Card */}
      <div className="rounded-lg bg-white/70 border border-slate-200 p-2.5 transition-colors shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800">Base Map</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Active Base Layer" />
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">OpenStreetMap Standard</p>
      </div>

      {/* Doppler Radar Card */}
      <div
        className={`rounded-lg p-2.5 transition-colors ${
          layers.radar
            ? 'bg-sky-50 border border-sky-300 shadow-2xs'
            : 'bg-white/70 border border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`font-semibold ${layers.radar ? 'text-sky-900' : 'text-slate-800'}`}>
            Doppler Radar
          </span>
          {layers.radar && <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />}
        </div>
        <p className={`text-[11px] mt-0.5 ${layers.radar ? 'text-sky-700' : 'text-slate-500'}`}>
          {layers.radar ? 'RainViewer Live Stream' : 'RainViewer API v2'}
        </p>
      </div>

      {/* Cloud & Satellite Layer Card */}
      <div
        className={`rounded-lg p-2.5 transition-colors ${
          layers.clouds || layers.satellite
            ? 'bg-sky-50 border border-sky-300 shadow-2xs'
            : 'bg-white/70 border border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`font-semibold ${
              layers.clouds || layers.satellite ? 'text-sky-900' : 'text-slate-800'
            }`}
          >
            {layers.satellite ? 'Satellite Imagery' : 'Cloud Cover & HUD'}
          </span>
          {(layers.clouds || layers.satellite) && (
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
          )}
        </div>
        <p
          className={`text-[11px] mt-0.5 ${
            layers.clouds || layers.satellite ? 'text-sky-700' : 'text-slate-500'
          }`}
        >
          {layers.satellite
            ? 'Live Earth Observation'
            : layers.clouds
            ? 'NASA GIBS Cloud Layer'
            : 'Open-Meteo Synced'}
        </p>
      </div>

      {/* Storms & Lightning Tracking Card */}
      <div
        className={`rounded-lg p-2.5 transition-colors ${
          layers.storms
            ? 'bg-purple-50 border border-purple-300 shadow-2xs'
            : 'bg-white/70 border border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`font-semibold ${layers.storms ? 'text-purple-900' : 'text-slate-800'}`}>
            Storms & Lightning
          </span>
          {layers.storms ? (
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
          ) : (
            <span className="text-[10px] text-slate-400 font-mono">READY</span>
          )}
        </div>
        <p className={`text-[11px] mt-0.5 ${layers.storms ? 'text-purple-700' : 'text-slate-500'}`}>
          {layers.storms ? 'Active Convection Layer' : 'Convective Tracker'}
        </p>
      </div>
    </div>
  );
}

export function WeatherMap({
  latitude,
  longitude,
  locationName,
  accuracy,
  source = 'manual',
  className = 'h-72 w-full',
  cloudCover,
  conditionDescription,
  condition,
  weatherData,
  isLoading,
  onLayerStateChange,
  showStatusCards = false,
}: WeatherMapProps) {
  const [layers, setLayers] = useState<LayerState>({
    radar: false,
    wind: false,
    clouds: false,
    satellite: false,
    storms: false,
  });

  const handleLayerStateChange = useCallback(
    (newLayers: LayerState) => {
      setLayers(newLayers);
      onLayerStateChange?.(newLayers);
    },
    [onLayerStateChange]
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wider text-slate-500 uppercase">
            Weather Map
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Centered at {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
            {accuracy !== undefined && ` (Accuracy: ±${accuracy}m)`}
          </p>
        </div>
      </div>
      <div className={`${className} rounded-lg border border-slate-200 overflow-hidden`}>
        <WeatherMapInternal
          latitude={latitude}
          longitude={longitude}
          locationName={locationName}
          accuracy={accuracy}
          source={source}
          cloudCover={cloudCover}
          conditionDescription={conditionDescription}
          condition={condition}
          weatherData={weatherData}
          isLoading={isLoading}
          onLayerStateChange={handleLayerStateChange}
        />
      </div>

      {showStatusCards && <MapStatusCards layers={layers} />}
    </section>
  );
}

