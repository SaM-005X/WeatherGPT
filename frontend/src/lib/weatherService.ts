/**
 * Dedicated Weather Service
 *
 * Provider: Open-Meteo Forecast REST API (https://api.open-meteo.com/v1/forecast)
 *
 * Architecture:
 *   activeLocation (lat, lon)
 *         ↓
 *   weatherService (coordinate-based, client cache, validation)
 *         ↓
 *   Open-Meteo REST API
 *         ↓
 *   provider response
 *         ↓
 *   normalization (Celsius preserved, WMO mapped, local timezone aligned)
 *         ↓
 *   application WeatherReport / WeatherData models
 *         ↓
 *   React UI Components
 */

import { CurrentWeather, DailyForecast, HourlyForecast, WeatherReport, CacheMetadata } from '@/types/weather';
import { mapWmoCode } from '@/lib/weatherCodes';

// ---------------------------------------------------------------------------
// Internal Open-Meteo API Types (Never exposed to UI components)
// ---------------------------------------------------------------------------

export interface OpenMeteoCurrent {
  time: string;
  interval?: number;
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  precipitation?: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  uv_index?: number;
  cloud_cover?: number;
}

export interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  apparent_temperature?: number[];
  precipitation_probability?: number[];
  weather_code: number[];
}

export interface OpenMeteoDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max?: number[];
  sunrise?: string[];
  sunset?: string[];
}

export interface OpenMeteoForecastResponse {
  latitude: number;
  longitude: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation?: string;
  current: OpenMeteoCurrent;
  hourly: OpenMeteoHourly;
  daily: OpenMeteoDaily;
}

// ---------------------------------------------------------------------------
// Tiered Freshness Policy & In-Memory Cache
// ---------------------------------------------------------------------------

export const FRESHNESS_POLICY = {
  CURRENT_TTL_MS: 5 * 60 * 1000,          // 5 minutes for real-time conditions
  HOURLY_TTL_MS: 30 * 60 * 1000,          // 30 minutes for hourly forecast
  DAILY_TTL_MS: 2 * 60 * 60 * 1000,       // 2 hours for 7-day daily forecast
  STALE_FALLBACK_MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours maximum for stale-while-revalidate fallback
} as const;

export interface WeatherCacheEntry {
  key: string;
  timestamp: number;
  currentFetchedAt: number;
  hourlyFetchedAt: number;
  dailyFetchedAt: number;
  data: WeatherReport;
}

const memoryCache = new Map<string, WeatherCacheEntry>();
const inFlightRequests = new Map<string, Promise<WeatherReport>>();

/**
 * Builds standard cache metadata for a given cache entry.
 */
export function buildCacheMetadata(entry: WeatherCacheEntry, now = Date.now()): CacheMetadata {
  const ageMs = Math.max(0, now - entry.timestamp);
  const isCurrentFresh = ageMs < FRESHNESS_POLICY.CURRENT_TTL_MS;
  const isStale = !isCurrentFresh;

  return {
    cachedAt: new Date(entry.timestamp).toISOString(),
    isCached: true,
    isFresh: isCurrentFresh,
    isStale,
    currentExpiresAt: new Date(entry.timestamp + FRESHNESS_POLICY.CURRENT_TTL_MS).toISOString(),
    hourlyExpiresAt: new Date(entry.timestamp + FRESHNESS_POLICY.HOURLY_TTL_MS).toISOString(),
    dailyExpiresAt: new Date(entry.timestamp + FRESHNESS_POLICY.DAILY_TTL_MS).toISOString(),
    ageSeconds: Math.floor(ageMs / 1000),
  };
}

export interface CacheStatus {
  isCached: boolean;
  isCurrentFresh: boolean;
  isHourlyFresh: boolean;
  isDailyFresh: boolean;
  ageMs: number;
  cachedAt?: string;
  currentExpiresAt?: string;
}

/**
 * Returns current cache status for given coordinates.
 */
export function getCacheStatus(latitude: number, longitude: number): CacheStatus {
  const key = getCacheKey(latitude, longitude);
  const entry = memoryCache.get(key);
  if (!entry) {
    return {
      isCached: false,
      isCurrentFresh: false,
      isHourlyFresh: false,
      isDailyFresh: false,
      ageMs: 0,
    };
  }

  const now = Date.now();
  const ageMs = Math.max(0, now - entry.timestamp);

  return {
    isCached: true,
    isCurrentFresh: ageMs < FRESHNESS_POLICY.CURRENT_TTL_MS,
    isHourlyFresh: ageMs < FRESHNESS_POLICY.HOURLY_TTL_MS,
    isDailyFresh: ageMs < FRESHNESS_POLICY.DAILY_TTL_MS,
    ageMs,
    cachedAt: new Date(entry.timestamp).toISOString(),
    currentExpiresAt: new Date(entry.timestamp + FRESHNESS_POLICY.CURRENT_TTL_MS).toISOString(),
  };
}

/**
 * Returns count of currently active in-flight network requests (useful for tests & monitoring).
 */
export function getInFlightRequestCount(): number {
  return inFlightRequests.size;
}

/**
 * Generates a deterministic cache key based on coordinates.
 */
export function getCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

/**
 * Clears the in-memory weather cache (useful for testing and debug).
 */
export function clearWeatherCache(): void {
  memoryCache.clear();
  inFlightRequests.clear();
}

// ---------------------------------------------------------------------------
// Coordinate Validation & URL Construction
// ---------------------------------------------------------------------------

export function validateCoordinates(latitude: number, longitude: number): void {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
    throw new Error('Invalid coordinates: Latitude and longitude must be valid numbers.');
  }
  if (latitude < -90 || latitude > 90) {
    throw new Error(`Invalid latitude (${latitude}): Must be between -90 and 90 degrees.`);
  }
  if (longitude < -180 || longitude > 180) {
    throw new Error(`Invalid longitude (${longitude}): Must be between -180 and 180 degrees.`);
  }
}

/**
 * Constructs the coordinate-based Open-Meteo URL.
 * Automatically aligns timezone to the location's local time.
 */
export function buildForecastUrl(latitude: number, longitude: number): string {
  validateCoordinates(latitude, longitude);

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitude.toString());
  url.searchParams.set('longitude', longitude.toString());
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index,cloud_cover'
  );
  url.searchParams.set(
    'hourly',
    'temperature_2m,apparent_temperature,precipitation_probability,weather_code'
  );
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset'
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '7');

  return url.toString();
}

// ---------------------------------------------------------------------------
// Normalization Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a YYYY-MM-DD date into "Today" for index 0 or short weekday (e.g. "Fri") for subsequent days.
 * Safe from UTC shift by parsing components and using local noon.
 */
export function formatForecastDay(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Computes an ISO-8601 observation timestamp from local time string and UTC offset seconds.
 */
export function calculateObservationIso(timeStr: string, utcOffsetSeconds?: number): string {
  try {
    if (typeof utcOffsetSeconds === 'number') {
      const localMs = new Date(timeStr + 'Z').getTime();
      const utcMs = localMs - utcOffsetSeconds * 1000;
      return new Date(utcMs).toISOString();
    }
    return new Date(timeStr).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Normalizes Open-Meteo current weather into the application model.
 * All temperatures are normalized strictly in Celsius.
 */
export function normalizeCurrentWeather(
  rawCurrent: OpenMeteoCurrent,
  utcOffsetSeconds?: number,
  isCached = false
): CurrentWeather {
  const codeDetails = mapWmoCode(rawCurrent.weather_code);

  return {
    temperature: rawCurrent.temperature_2m,
    feelsLike: rawCurrent.apparent_temperature,
    humidity: Math.round(rawCurrent.relative_humidity_2m),
    windSpeed: Math.round(rawCurrent.wind_speed_10m * 10) / 10,
    windDirection: Math.round(rawCurrent.wind_direction_10m),
    weatherCode: rawCurrent.weather_code,
    condition: codeDetails.condition,
    conditionDescription: codeDetails.description,
    precipitation: typeof rawCurrent.precipitation === 'number' ? rawCurrent.precipitation : 0,
    uvIndex: typeof rawCurrent.uv_index === 'number' ? rawCurrent.uv_index : undefined,
    cloudCover: typeof rawCurrent.cloud_cover === 'number' ? Math.round(rawCurrent.cloud_cover) : undefined,
    recordedAt: calculateObservationIso(rawCurrent.time, utcOffsetSeconds),
    isCached,
  };
}

/**
 * Normalizes Open-Meteo hourly weather into a 24-hour horizon.
 * Starts from the current local hour (or index 0) for 24 entries.
 */
export function normalizeHourlyForecast(
  rawHourly: OpenMeteoHourly,
  currentTime?: string
): HourlyForecast[] {
  if (!rawHourly || !Array.isArray(rawHourly.time) || rawHourly.time.length === 0) {
    return [];
  }

  // Find index corresponding to current hour or first available
  let startIndex = 0;
  if (currentTime) {
    const foundIdx = rawHourly.time.findIndex((t) => t >= currentTime);
    if (foundIdx !== -1) {
      startIndex = foundIdx;
    }
  }

  const endIndex = Math.min(startIndex + 24, rawHourly.time.length);
  const result: HourlyForecast[] = [];

  for (let i = startIndex; i < endIndex; i++) {
    const rawTime = rawHourly.time[i];
    // rawTime is formatted as YYYY-MM-DDTHH:MM in local timezone
    const timeDisplay = rawTime.length >= 16 ? rawTime.slice(11, 16) : rawTime;
    const weatherCode = rawHourly.weather_code[i] ?? 0;
    const codeDetails = mapWmoCode(weatherCode);

    result.push({
      time: timeDisplay,
      temperature: rawHourly.temperature_2m[i],
      precipitationProbability: rawHourly.precipitation_probability ? rawHourly.precipitation_probability[i] ?? 0 : 0,
      weatherCode,
      condition: codeDetails.condition,
    });
  }

  return result;
}

/**
 * Normalizes Open-Meteo daily forecast (7 days).
 */
export function normalizeDailyForecast(rawDaily: OpenMeteoDaily): DailyForecast[] {
  if (!rawDaily || !Array.isArray(rawDaily.time) || rawDaily.time.length === 0) {
    return [];
  }

  const daysCount = Math.min(rawDaily.time.length, 7);
  const result: DailyForecast[] = [];

  for (let i = 0; i < daysCount; i++) {
    const dateStr = rawDaily.time[i];
    const weatherCode = rawDaily.weather_code[i] ?? 0;
    const codeDetails = mapWmoCode(weatherCode);

    result.push({
      date: formatForecastDay(dateStr, i),
      temperatureMin: rawDaily.temperature_2m_min[i],
      temperatureMax: rawDaily.temperature_2m_max[i],
      precipitationProbability: rawDaily.precipitation_probability_max
        ? rawDaily.precipitation_probability_max[i] ?? 0
        : 0,
      weatherCode,
      condition: codeDetails.condition,
      sunrise: rawDaily.sunrise && rawDaily.sunrise[i] ? rawDaily.sunrise[i].slice(11, 16) : undefined,
      sunset: rawDaily.sunset && rawDaily.sunset[i] ? rawDaily.sunset[i].slice(11, 16) : undefined,
    });
  }

  return result;
}

/**
 * Normalizes the complete Open-Meteo response into the application WeatherReport.
 */
export function normalizeWeatherResponse(
  raw: OpenMeteoForecastResponse,
  locationId: string,
  isCached = false
): WeatherReport {
  if (!raw || !raw.current || !raw.hourly || !raw.daily) {
    throw new Error('Malformed weather response: Missing current, hourly, or daily data from provider.');
  }

  const current = normalizeCurrentWeather(raw.current, raw.utc_offset_seconds, isCached);
  const hourly = normalizeHourlyForecast(raw.hourly, raw.current.time);
  const daily = normalizeDailyForecast(raw.daily);

  return {
    locationId,
    current,
    hourly,
    daily,
    lastUpdated: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    timezone: raw.timezone,
  };
}

// ---------------------------------------------------------------------------
// Public Weather Service Interface
// ---------------------------------------------------------------------------

export interface WeatherFetchOptions {
  signal?: AbortSignal;
  forceRefresh?: boolean;
  allowStaleFallback?: boolean;
}

/**
 * Attaches an AbortSignal to a promise without cancelling the underlying work
 * for other concurrent callers sharing the promise.
 */
function attachAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('The user aborted a request.', 'AbortError'));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('The user aborted a request.', 'AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });

    promise
      .then((val) => {
        signal.removeEventListener('abort', onAbort);
        resolve(val);
      })
      .catch((err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      });
  });
}

/**
 * Low-level network fetch to Open-Meteo REST API.
 * Uses an independent network timeout (15s) so individual caller cancellations
 * do not tear down shared in-flight requests.
 */
async function executeNetworkFetch(
  latitude: number,
  longitude: number
): Promise<WeatherReport> {
  const url = buildForecastUrl(latitude, longitude);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('Weather network request timed out after 15 seconds.');
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown network failure';
    throw new Error(`Weather network request failed: ${message}`);
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson?.reason) {
        errorDetail = errJson.reason;
      }
    } catch {
      // Fall back to status text if body is not JSON
    }
    throw new Error(`Weather service error: ${errorDetail}`);
  }

  let rawData: OpenMeteoForecastResponse;
  try {
    rawData = (await response.json()) as OpenMeteoForecastResponse;
  } catch {
    throw new Error('Failed to parse weather service response as JSON.');
  }

  const locationId = `coords-${latitude.toFixed(4)}-${longitude.toFixed(4)}`;
  return normalizeWeatherResponse(rawData, locationId, false);
}

/**
 * Fetches weather data for specified coordinates.
 *
 * Tiered Freshness Architecture:
 * 1. Validate coordinates.
 * 2. Check 5-minute memory cache (unless forceRefresh is true).
 * 3. Deduplicate in-flight requests (prevent duplicate concurrent calls for same coordinates).
 * 4. Fetch from Open-Meteo REST API and normalize into WeatherReport.
 * 5. On failure, fall back to previous valid cached data (stale-while-revalidate) if available.
 * 6. Populate cache with fine-grained timestamps and metadata.
 */
export async function fetchWeatherData(
  latitude: number,
  longitude: number,
  options?: WeatherFetchOptions
): Promise<WeatherReport> {
  validateCoordinates(latitude, longitude);

  const cacheKey = getCacheKey(latitude, longitude);
  const now = Date.now();
  const cached = memoryCache.get(cacheKey);

  // 1. Fresh Cache Hit (unless forceRefresh is true)
  if (!options?.forceRefresh && cached) {
    const isCurrentFresh = (now - cached.timestamp) < FRESHNESS_POLICY.CURRENT_TTL_MS;
    if (isCurrentFresh) {
      return {
        ...cached.data,
        current: {
          ...cached.data.current,
          isCached: true,
          isStale: false,
        },
        cacheMetadata: buildCacheMetadata(cached, now),
      };
    }
  }

  // 2. In-Flight Request Deduplication: Re-use active network request if already in flight
  if (inFlightRequests.has(cacheKey)) {
    const inFlight = inFlightRequests.get(cacheKey)!;
    return await attachAbortSignal(inFlight, options?.signal);
  }

  // 3. Initiate Network Fetch wrapped in inFlightRequests registry
  const fetchPromise = (async (): Promise<WeatherReport> => {
    try {
      const freshData = await executeNetworkFetch(latitude, longitude);

      const fetchTime = Date.now();
      const newEntry: WeatherCacheEntry = {
        key: cacheKey,
        timestamp: fetchTime,
        currentFetchedAt: fetchTime,
        hourlyFetchedAt: fetchTime,
        dailyFetchedAt: fetchTime,
        data: freshData,
      };

      memoryCache.set(cacheKey, newEntry);

      return {
        ...freshData,
        current: {
          ...freshData.current,
          isCached: false,
          isStale: false,
        },
        cacheMetadata: buildCacheMetadata(newEntry, fetchTime),
      };
    } catch (err: unknown) {
      // 4. Stale-while-revalidate fallback: If network fails and cached data is available within 24h
      const allowFallback = options?.allowStaleFallback !== false;
      if (allowFallback && cached && (Date.now() - cached.timestamp < FRESHNESS_POLICY.STALE_FALLBACK_MAX_AGE_MS)) {
        return {
          ...cached.data,
          current: {
            ...cached.data.current,
            isCached: true,
            isStale: true,
          },
          cacheMetadata: {
            ...buildCacheMetadata(cached, Date.now()),
            isStale: true,
            isFresh: false,
          },
        };
      }

      throw err;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return await attachAbortSignal(fetchPromise, options?.signal);
}
