'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

interface WeatherMapProps {
  latitude: number;
  longitude: number;
  locationName?: string;
  accuracy?: number;
  source?: 'device' | 'manual';
  className?: string;
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

export function WeatherMap({
  latitude,
  longitude,
  locationName,
  accuracy,
  source = 'manual',
  className = 'h-72 w-full',
}: WeatherMapProps) {
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
        />
      </div>
    </section>
  );
}
