/**
 * Dedicated Geocoding & Coordinate Resolution Service
 *
 * Provider: Open-Meteo Geocoding REST API (https://geocoding-api.open-meteo.com/v1/search)
 *
 * Responsibilities:
 * 1. Direct coordinate parsing (comma-separated, space-separated, degree/cardinal formats).
 * 2. Coordinate range validation (latitude: -90 to +90, longitude: -180 to +180).
 * 3. Place-name search via Open-Meteo Geocoding API.
 * 4. Normalization into typed GeocodingResult and ActiveLocation models.
 */

import { ActiveLocation, GeocodingResult } from '@/types/location';
import { getCachedGeocoding, setCachedGeocoding } from '@/lib/locationPersistenceService';

export interface CoordinateParseResult {
  latitude: number;
  longitude: number;
}

/**
 * Attempts to parse an input string as geographic coordinates.
 * Supports:
 * - "22.5726, 88.3639"
 * - "22.5726 88.3639"
 * - "-33.8688, 151.2093"
 * - "22.5726° N, 88.3639° E"
 * - "33.8688° S, 151.2093° E"
 *
 * Throws a descriptive Error if the input is coordinate-shaped but out-of-range (e.g. "100, 200").
 * Returns null if the input is not a coordinate string (e.g. a city name like "Tokyo" or "Norway").
 */
export function parseCoordinateInput(input: string): CoordinateParseResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Regex pattern 1: Standard decimal coordinates with optional degree symbols & cardinal letters
  // Examples: "22.5726, 88.3639", "22.5726 88.3639", "22.5726° N, 88.3639° E"
  const cardinalRegex =
    /^(-?\d+(?:\.\d+)?)\s*°?\s*([NSns])?\s*[,/ ]\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EWew])?$/;
  const match = trimmed.match(cardinalRegex);

  if (match) {
    let lat = parseFloat(match[1]);
    const latHemi = match[2]?.toUpperCase();
    let lon = parseFloat(match[3]);
    const lonHemi = match[4]?.toUpperCase();

    if (latHemi === 'S' && lat > 0) lat = -lat;
    if (lonHemi === 'W' && lon > 0) lon = -lon;

    // Validate boundaries
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error(
        `Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.`
      );
    }

    return {
      latitude: Number(lat.toFixed(4)),
      longitude: Number(lon.toFixed(4)),
    };
  }

  // Regex pattern 2: Comma or space separated numbers without cardinals (e.g. "100, 200" or "-45.12 120.34")
  const simpleCoordRegex = /^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/;
  const simpleMatch = trimmed.match(simpleCoordRegex);

  if (simpleMatch) {
    const lat = parseFloat(simpleMatch[1]);
    const lon = parseFloat(simpleMatch[2]);

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error(
        `Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.`
      );
    }

    return {
      latitude: Number(lat.toFixed(4)),
      longitude: Number(lon.toFixed(4)),
    };
  }

  // Not a coordinate string; treat as place/city name query
  return null;
}

/**
 * Raw response item structure from Open-Meteo Geocoding API.
 */
interface OpenMeteoGeocodingItem {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  feature_code?: string;
  country_code?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  timezone?: string;
  population?: number;
}

interface OpenMeteoGeocodingResponse {
  results?: OpenMeteoGeocodingItem[];
  generationtime_ms?: number;
}


/**
 * Searches the Open-Meteo Geocoding API for place names (e.g. "Tokyo", "Norway", "Springfield").
 * Incorporates Supabase geocoding caching to reduce external network round-trips.
 * Returns an array of normalized GeocodingResult objects.
 */
export async function searchGeocodingLocations(
  query: string,
  signal?: AbortSignal,
  bypassCache = false
): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  // 1. Check Supabase Geocoding Cache first (unless explicitly bypassed)
  if (!bypassCache) {
    try {
      const cached = await getCachedGeocoding(trimmed);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    } catch {
      // Non-blocking fallback to direct network call
    }
  }

  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', trimmed);
  url.searchParams.set('count', '5');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new Error('Unable to search for this location. Please check your connection.');
  }

  if (!response.ok) {
    throw new Error(`Location search failed: HTTP ${response.status} ${response.statusText}`);
  }

  let data: OpenMeteoGeocodingResponse;
  try {
    data = (await response.json()) as OpenMeteoGeocodingResponse;
  } catch {
    throw new Error('Failed to parse geocoding service response.');
  }

  if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
    return [];
  }

  const normalizedResults: GeocodingResult[] = data.results.map((item) => ({
    id: item.id,
    name: item.name,
    latitude: Number(item.latitude.toFixed(4)),
    longitude: Number(item.longitude.toFixed(4)),
    country: item.country,
    countryCode: item.country_code,
    admin1: item.admin1,
    timezone: item.timezone,
  }));

  // 2. Asynchronously save results to Supabase cache (fire-and-forget, non-blocking)
  setCachedGeocoding(trimmed, normalizedResults).catch(() => { });

  return normalizedResults;
}

/**
 * Factory helper: Converts a GeocodingResult into an ActiveLocation.
 */
export function createLocationFromGeocoding(result: GeocodingResult): ActiveLocation {
  return {
    id: `loc-geo-${result.id}`,
    name: result.name,
    country: result.country,
    state: result.admin1,
    admin1: result.admin1,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
    source: 'manual',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Factory helper: Converts raw coordinates into an ActiveLocation.
 */
export function createLocationFromCoordinates(
  latitude: number,
  longitude: number
): ActiveLocation {
  return {
    id: `loc-coord-${Date.now()}`,
    name: `Coordinates (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`,
    latitude: Number(latitude.toFixed(4)),
    longitude: Number(longitude.toFixed(4)),
    source: 'manual',
    timestamp: new Date().toISOString(),
  };
}
