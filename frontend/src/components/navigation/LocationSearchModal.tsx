'use client';

import React, { useState } from 'react';
import { useLocationContext } from '@/context/LocationContext';
import { PRESET_LOCATIONS } from '@/lib/presetLocations';
import { GeocodingResult } from '@/types/location';

interface LocationSearchModalProps {
  onClose: () => void;
}

export function LocationSearchModal({ onClose }: LocationSearchModalProps) {
  const {
    activeLocation,
    savedLocations,
    requestDeviceLocation,
    setManualLocation,
    resolveLocationQuery,
  } = useLocationContext();

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setErrorMessage(null);
    setSearchResults([]);

    try {
      const res = await resolveLocationQuery(query);
      if (res.status === 'COORDINATES_RESOLVED' || res.status === 'PRESET_RESOLVED' || res.status === 'SINGLE_RESULT') {
        onClose();
      } else if (res.status === 'MULTIPLE_RESULTS' && res.results) {
        setSearchResults(res.results);
      } else if (res.status === 'NO_RESULTS' || res.status === 'ERROR') {
        setErrorMessage(res.error || 'No location found. Please try another search.');
      }
    } catch {
      setErrorMessage('Search error occurred. Please verify your connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (result: GeocodingResult) => {
    setManualLocation({
      id: `loc-${result.id}`,
      name: result.name,
      country: result.country,
      state: result.admin1,
      admin1: result.admin1,
      latitude: Number(result.latitude.toFixed(4)),
      longitude: Number(result.longitude.toFixed(4)),
      timezone: result.timezone,
      source: 'manual',
      timestamp: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Change Location</h3>
            <p className="text-xs text-slate-500">
              Active: <span className="font-semibold text-slate-700">{activeLocation.name}</span> ({activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°)
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city, region, or coordinates (e.g. 22.57, 88.36)..."
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-sky-700 transition disabled:opacity-50 cursor-pointer"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Multiple Search Results Disambiguation */}
        {searchResults.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2">
            <span className="text-[11px] font-semibold text-slate-500 px-1">
              Select Matching Place:
            </span>
            {searchResults.map((res) => (
              <button
                key={`${res.id}-${res.latitude}`}
                onClick={() => handleSelectResult(res)}
                className="w-full text-left rounded-lg bg-white p-2 text-xs border border-slate-200/80 hover:border-sky-300 hover:bg-sky-50 transition cursor-pointer flex justify-between items-center"
              >
                <div>
                  <span className="font-semibold text-slate-800">{res.name}</span>
                  {(res.admin1 || res.country) && (
                    <span className="text-slate-500 ml-1">
                      ({[res.admin1, res.country].filter(Boolean).join(', ')})
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400">
                  {res.latitude.toFixed(2)}°, {res.longitude.toFixed(2)}°
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Device Geolocation Quick Action */}
        <div className="pt-1">
          <button
            onClick={() => {
              requestDeviceLocation();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 py-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition cursor-pointer"
          >
            <span>📍</span>
            <span>Use My Current Device Location (GPS)</span>
          </button>
        </div>

        {/* Preset Cities */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Popular Cities
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_LOCATIONS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setManualLocation(preset);
                  onClose();
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  activeLocation.name === preset.name
                    ? 'border-sky-500 bg-sky-50 text-sky-700 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Saved Locations from Supabase */}
        {savedLocations.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Recently Saved Locations
            </span>
            <div className="flex flex-wrap gap-1.5">
              {savedLocations.slice(0, 6).map((saved) => (
                <button
                  key={saved.id}
                  onClick={() => {
                    setManualLocation(saved);
                    onClose();
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  <span className="text-slate-400">★</span>
                  <span>{saved.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
