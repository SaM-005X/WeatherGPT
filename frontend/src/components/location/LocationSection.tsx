'use client';

import React, { useState } from 'react';
import { ActiveLocation, GeocodingResult, GeolocationError } from '@/types/location';
import { PRESET_LOCATIONS } from '@/lib/presetLocations';
import { createLocationFromGeocoding } from '@/lib/geocodingService';
import { QueryResolutionResult } from '@/hooks/useLocationSystem';

interface LocationSectionProps {
  activeLocation: ActiveLocation;
  isLoading: boolean;
  error: GeolocationError | null;
  savedLocations?: ActiveLocation[];
  onRequestGeolocation: () => void;
  onSelectPreset: (location: ActiveLocation) => void;
  onResolveQuery: (query: string) => Promise<QueryResolutionResult>;
  onDismissError?: () => void;
}

export function LocationSection({
  activeLocation,
  isLoading,
  error,
  savedLocations = [],
  onRequestGeolocation,
  onSelectPreset,
  onResolveQuery,
  onDismissError,
}: LocationSectionProps) {
  const [queryInput, setQueryInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    setSearchResults([]);

    const trimmed = queryInput.trim();
    if (!trimmed) {
      setInputError('Please enter a city, place name, or coordinates (e.g. 22.57, 88.36).');
      return;
    }

    setIsSearching(true);
    try {
      const resolution = await onResolveQuery(trimmed);

      if (resolution.status === 'ERROR' || resolution.status === 'NO_RESULTS') {
        setInputError(resolution.error || 'Location not found. Try another city, country, or coordinates.');
      } else if (resolution.status === 'MULTIPLE_RESULTS' && resolution.results) {
        setSearchResults(resolution.results);
      } else {
        // COORDINATES_RESOLVED, PRESET_RESOLVED, or SINGLE_RESULT
        setQueryInput('');
        setSearchResults([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to search for location.';
      setInputError(msg);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (result: GeocodingResult) => {
    const newLocation = createLocationFromGeocoding(result);
    onSelectPreset(newLocation);
    setSearchResults([]);
    setQueryInput('');
    setInputError(null);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      {/* 1. Selected Location Primary Display */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Active Location
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {activeLocation.name}
            </h2>
            {(activeLocation.admin1 || activeLocation.country) && (
              <span className="text-base font-normal text-slate-500">
                {[activeLocation.admin1, activeLocation.country].filter(Boolean).join(', ')}
              </span>
            )}
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${
                activeLocation.source === 'device'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-sky-50 text-sky-700 border border-sky-200'
              }`}
            >
              {activeLocation.source}
            </span>
          </div>

          {/* Location Technical Details (Coordinates & Accuracy) */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
            <span>
              <strong className="font-medium text-slate-700">Lat:</strong>{' '}
              {activeLocation.latitude.toFixed(4)}°
            </span>
            <span>
              <strong className="font-medium text-slate-700">Lon:</strong>{' '}
              {activeLocation.longitude.toFixed(4)}°
            </span>
            {activeLocation.timezone && (
              <span>
                <strong className="font-medium text-slate-700">Timezone:</strong>{' '}
                {activeLocation.timezone}
              </span>
            )}
            {activeLocation.accuracy !== undefined && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Accuracy: ±{activeLocation.accuracy} m
              </span>
            )}
          </div>
        </div>

        {/* Primary Action: Use My Location */}
        <button
          type="button"
          onClick={() => {
            setSearchResults([]);
            setInputError(null);
            onRequestGeolocation();
          }}
          disabled={isLoading || isSearching}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 shrink-0 cursor-pointer"
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Locating...</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Use My Location</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Manual Location Selection Form & Presets */}
      <div className="pt-4 space-y-3">
        <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={queryInput}
              onChange={(e) => {
                setQueryInput(e.target.value);
                if (inputError) setInputError(null);
              }}
              placeholder="Search by city (e.g. Kolkata, Tokyo), place (e.g. Norway), or coords (e.g. 22.57, 88.36)..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!queryInput.trim() || isLoading || isSearching}
            className="rounded-lg bg-slate-800 hover:bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            {isSearching ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Searching...</span>
              </>
            ) : (
              <span>Search</span>
            )}
          </button>
        </form>

        {/* 3. Multiple Search Results Disambiguation List */}
        {searchResults.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="text-xs font-semibold text-slate-600">
                Matching locations ({searchResults.length}):
              </span>
              <button
                type="button"
                onClick={() => setSearchResults([])}
                className="text-xs font-medium text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Close ✕
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {searchResults.map((result) => (
                <button
                  key={`${result.id}-${result.latitude}-${result.longitude}`}
                  type="button"
                  onClick={() => handleSelectResult(result)}
                  className="w-full text-left py-2 px-2 rounded-md hover:bg-sky-50/80 transition flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-sky-700">
                      {result.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[result.admin1, result.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-400 font-mono">
                    {result.latitude.toFixed(2)}°, {result.longitude.toFixed(2)}°
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Presets Picker */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-slate-400 mr-1 font-medium">Presets:</span>
          {PRESET_LOCATIONS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setSearchResults([]);
                setInputError(null);
                onSelectPreset(preset);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                activeLocation.id === preset.id
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Recently Persisted Locations (Supabase Data Layer) */}
        {savedLocations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-xs text-slate-400 mr-1 font-medium">Saved:</span>
            {savedLocations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  setSearchResults([]);
                  setInputError(null);
                  onSelectPreset(loc);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                  Math.abs(activeLocation.latitude - loc.latitude) < 0.001 &&
                  Math.abs(activeLocation.longitude - loc.longitude) < 0.001
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80'
                }`}
              >
                <span>📍</span>
                <span>{loc.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. User-Friendly Error Banners */}
      {(error || inputError) && (
        <div className="mt-4 flex items-start justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <svg className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold">
                {error?.type === 'PERMISSION_DENIED'
                  ? 'Location Access Denied'
                  : error?.type === 'POSITION_UNAVAILABLE'
                  ? 'Location Unavailable'
                  : error?.type === 'TIMEOUT'
                  ? 'Request Timed Out'
                  : error?.type === 'UNSUPPORTED'
                  ? 'Browser Not Supported'
                  : error?.type === 'INVALID_COORDINATES'
                  ? 'Invalid Coordinates'
                  : error?.type === 'NOT_FOUND'
                  ? 'Location Not Found'
                  : 'Location Notice'}
              </p>
              <p className="mt-0.5 text-amber-800">{inputError || error?.message}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setInputError(null);
              if (onDismissError) onDismissError();
            }}
            className="text-amber-700 hover:text-amber-900 text-sm ml-2 font-bold leading-none cursor-pointer"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
