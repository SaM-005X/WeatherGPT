/**
 * Dedicated Wind Service
 *
 * Provider: Open-Meteo REST API (current=wind_speed_10m,wind_direction_10m,wind_gusts_10m)
 *
 * Responsibilities:
 * - Directional angle-to-cardinal conversion (16-point compass)
 * - Beaufort scale calculation (0–12)
 * - Unit conversions (km/h, mph, knots)
 * - Wind SVG vector icon generation for Leaflet markers
 * - Open-Meteo fetcher with 5-minute in-memory caching & deduplication
 */

export interface WindData {
  speedKmh: number;
  speedMph: number;
  speedKnots: number;
  directionDegrees: number;
  cardinalDirection: string;
  gustsKmh?: number;
  gustsMph?: number;
  beaufortScale: number;
  beaufortDescription: string;
  fetchedAt: string;
  isCached?: boolean;
}

export const CARDINAL_COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

export const BEAUFORT_SCALE_TABLE = [
  { scale: 0, minKmh: 0, maxKmh: 1, description: 'Calm' },
  { scale: 1, minKmh: 1, maxKmh: 5, description: 'Light Air' },
  { scale: 2, minKmh: 6, maxKmh: 11, description: 'Light Breeze' },
  { scale: 3, minKmh: 12, maxKmh: 19, description: 'Gentle Breeze' },
  { scale: 4, minKmh: 20, maxKmh: 28, description: 'Moderate Breeze' },
  { scale: 5, minKmh: 29, maxKmh: 38, description: 'Fresh Breeze' },
  { scale: 6, minKmh: 39, maxKmh: 49, description: 'Strong Breeze' },
  { scale: 7, minKmh: 50, maxKmh: 61, description: 'High Wind' },
  { scale: 8, minKmh: 62, maxKmh: 74, description: 'Gale' },
  { scale: 9, minKmh: 75, maxKmh: 88, description: 'Strong Gale' },
  { scale: 10, minKmh: 89, maxKmh: 102, description: 'Storm' },
  { scale: 11, minKmh: 103, maxKmh: 117, description: 'Violent Storm' },
  { scale: 12, minKmh: 118, maxKmh: Infinity, description: 'Hurricane' },
] as const;

export const WIND_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const windCache = new Map<string, { timestamp: number; data: WindData }>();
const windInFlightRequests = new Map<string, Promise<WindData>>();

/**
 * Converts wind direction in degrees (0–360°) to 16-point cardinal compass string.
 */
export function degreesToCardinal(degrees: number): string {
  if (typeof degrees !== 'number' || isNaN(degrees)) {
    return 'N';
  }
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return CARDINAL_COMPASS_POINTS[index];
}

/**
 * Calculates Beaufort scale number (0–12) and description for a given wind speed in km/h.
 */
export function calculateBeaufortScale(speedKmh: number): { scale: number; description: string } {
  const speed = Math.max(0, speedKmh);
  const entry = BEAUFORT_SCALE_TABLE.find(
    (row) => speed >= row.minKmh && speed <= row.maxKmh
  ) || BEAUFORT_SCALE_TABLE[BEAUFORT_SCALE_TABLE.length - 1];

  return {
    scale: entry.scale,
    description: entry.description,
  };
}

/**
 * Unit Conversions
 */
export function kmhToMph(speedKmh: number): number {
  return Math.round(speedKmh * 0.621371 * 10) / 10;
}

export function kmhToKnots(speedKmh: number): number {
  return Math.round(speedKmh * 0.539957 * 10) / 10;
}

/**
 * Normalizes raw wind inputs into WindData model.
 */
export function normalizeWindData(
  speedKmh: number,
  directionDegrees: number,
  gustsKmh?: number,
  now = Date.now()
): WindData {
  const safeSpeed = Math.max(0, Number(speedKmh) || 0);
  const safeDegrees = ((Number(directionDegrees) || 0) % 360 + 360) % 360;
  const safeGusts = gustsKmh !== undefined ? Math.max(0, Number(gustsKmh) || 0) : undefined;

  const beaufort = calculateBeaufortScale(safeSpeed);

  return {
    speedKmh: Math.round(safeSpeed * 10) / 10,
    speedMph: kmhToMph(safeSpeed),
    speedKnots: kmhToKnots(safeSpeed),
    directionDegrees: safeDegrees,
    cardinalDirection: degreesToCardinal(safeDegrees),
    gustsKmh: safeGusts !== undefined ? Math.round(safeGusts * 10) / 10 : undefined,
    gustsMph: safeGusts !== undefined ? kmhToMph(safeGusts) : undefined,
    beaufortScale: beaufort.scale,
    beaufortDescription: beaufort.description,
    fetchedAt: new Date(now).toISOString(),
    isCached: false,
  };
}

/**
 * Generates inline SVG markup for a rotated wind direction vector arrow.
 */
export function generateWindArrowSvg(
  directionDegrees: number,
  color = '#0284c7',
  size = 28
): string {
  const rotation = (directionDegrees + 180) % 360; // Arrow points towards wind flow destination
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${rotation}deg); transform-origin: center; transition: transform 0.3s ease;">
    <path d="M12 2L19 21L12 17L5 21L12 2Z" fill="${color}" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

/**
 * Generates an animated SVG streamline vector icon for regional wind grid nodes.
 * Uses an outer container for rotation and an inner element for GPU-accelerated pulse/flow animation.
 */
export function generateWindStreamlineSvg(
  directionDegrees: number,
  speedKmh: number,
  index = 0,
  color = '#0284c7',
  size = 22
): string {
  const rotation = (directionDegrees + 180) % 360;
  const clampedSpeed = Math.max(5, Math.min(120, speedKmh));
  // Faster wind speed = shorter duration / faster pulse
  const durationSec = Math.max(0.6, Math.min(2.8, 35 / clampedSpeed)).toFixed(2);
  const delaySec = ((index % 8) * 0.1).toFixed(2);

  return `<div style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; transform: rotate(${rotation}deg); transform-origin: center; pointer-events: none;"><div style="animation: windVectorPulse ${durationSec}s ease-in-out infinite ${delaySec}s; display: flex; align-items: center; justify-content: center;"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.5 8.5H13V22H11V8.5H8.5L12 2Z" fill="${color}" fill-opacity="0.8" /><circle cx="12" cy="12" r="1.5" fill="#38bdf8" fill-opacity="0.9" /></svg></div></div>`;
}

/**
 * Fetches current wind metrics from Open-Meteo REST API for coordinates.
 */
export async function fetchWindData(
  latitude: number,
  longitude: number,
  options?: {
    forceRefresh?: boolean;
    signal?: AbortSignal;
    fetchFn?: typeof fetch;
  }
): Promise<WindData> {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const now = Date.now();
  const cached = windCache.get(cacheKey);

  if (!options?.forceRefresh && cached) {
    if (now - cached.timestamp < WIND_CACHE_TTL_MS) {
      return { ...cached.data, isCached: true };
    }
  }

  if (windInFlightRequests.has(cacheKey)) {
    return await windInFlightRequests.get(cacheKey)!;
  }

  const customFetch = options?.fetchFn ?? fetch;

  const fetchPromise = (async (): Promise<WindData> => {
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', latitude.toString());
      url.searchParams.set('longitude', longitude.toString());
      url.searchParams.set('current', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m');
      url.searchParams.set('timezone', 'auto');

      const res = await customFetch(url.toString(), {
        signal: options?.signal,
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Open-Meteo wind API HTTP error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      const current = json.current;

      const windData = normalizeWindData(
        current?.wind_speed_10m ?? 0,
        current?.wind_direction_10m ?? 0,
        current?.wind_gusts_10m,
        Date.now()
      );

      windCache.set(cacheKey, { timestamp: Date.now(), data: windData });
      return windData;
    } catch (err: unknown) {
      if (cached) {
        return { ...cached.data, isCached: true };
      }
      throw err;
    } finally {
      windInFlightRequests.delete(cacheKey);
    }
  })();

  windInFlightRequests.set(cacheKey, fetchPromise);
  return await fetchPromise;
}

/**
 * Clears the in-memory wind cache (for testing).
 */
export function clearWindCache(): void {
  windCache.clear();
  windInFlightRequests.clear();
}
