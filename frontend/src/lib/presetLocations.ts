/**
 * ISOLATED PRESET LOCATIONS
 * 
 * Provides development presets and fallback coordinates for Phase 2 manual selection.
 * This is cleanly isolated and can be swapped for a live geocoding provider in later phases.
 */

import { ActiveLocation } from '@/types/location';

export const PRESET_LOCATIONS: ActiveLocation[] = [
  {
    id: 'preset-london',
    name: 'London',
    country: 'United Kingdom',
    state: 'England',
    latitude: 51.5074,
    longitude: -0.1278,
    source: 'manual',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'preset-kolkata',
    name: 'Kolkata',
    country: 'India',
    state: 'West Bengal',
    latitude: 22.5726,
    longitude: 88.3639,
    source: 'manual',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'preset-new-york',
    name: 'New York',
    country: 'United States',
    state: 'New York',
    latitude: 40.7128,
    longitude: -74.0060,
    source: 'manual',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'preset-tokyo',
    name: 'Tokyo',
    country: 'Japan',
    state: 'Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
    source: 'manual',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'preset-paris',
    name: 'Paris',
    country: 'France',
    state: 'Île-de-France',
    latitude: 48.8566,
    longitude: 2.3522,
    source: 'manual',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'preset-sydney',
    name: 'Sydney',
    country: 'Australia',
    state: 'New South Wales',
    latitude: -33.8688,
    longitude: 151.2093,
    source: 'manual',
    timestamp: new Date().toISOString(),
  },
];

export const DEFAULT_ACTIVE_LOCATION: ActiveLocation = PRESET_LOCATIONS[0]; // London as standard default

/**
 * Searches isolated preset locations by query string (case-insensitive).
 */
export function findMatchingPreset(query: string): ActiveLocation | undefined {
  const normalized = query.trim().toLowerCase();
  return PRESET_LOCATIONS.find(
    (loc) =>
      loc.name.toLowerCase() === normalized ||
      loc.name.toLowerCase().includes(normalized) ||
      (loc.country && loc.country.toLowerCase().includes(normalized))
  );
}
