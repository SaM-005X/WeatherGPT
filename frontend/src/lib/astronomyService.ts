/**
 * Sun & Moon Astronomy Service
 *
 * Fetches solar ephemeris (sunrise, sunset, daylight duration) from Open-Meteo,
 * computes real-time solar arc progress, and calculates lunar cycle metrics using
 * synodic month mathematics (29.53058867-day synodic period).
 *
 * Source: Open-Meteo Forecast API & Astronomical Calculations
 */

export const SYNODIC_MONTH_DAYS = 29.53058867;
export const LUNAR_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14, 0); // Jan 6, 2000 18:14 UTC

export type MoonPhaseName =
  | 'New Moon'
  | 'Waxing Crescent'
  | 'First Quarter'
  | 'Waxing Gibbous'
  | 'Full Moon'
  | 'Waning Gibbous'
  | 'Last Quarter'
  | 'Waning Crescent';

export interface LunarMetrics {
  phaseFraction: number; // 0.0 - 1.0
  illuminationPercent: number; // 0 - 100%
  phaseName: MoonPhaseName;
  emoji: string;
  ageDays: number;
  daysUntilNextFullMoon: number;
  daysUntilNextNewMoon: number;
}

export interface SolarArcMetrics {
  sunriseTime: string; // Formatted local time e.g. "06:14 AM"
  sunsetTime: string;  // Formatted local time e.g. "06:02 PM"
  sunriseIso: string;
  sunsetIso: string;
  daylightDurationSeconds: number;
  daylightDurationFormatted: string; // e.g. "11h 48m"
  progressPercent: number; // 0 - 100%
  isSunUp: boolean;
  solarStatus: 'Pre-Dawn' | 'Daylight' | 'Post-Dusk';
  solarNoonTime: string;
  goldenHourMorning: string;
  goldenHourEvening: string;
}

export interface AstronomyReport {
  locationId: string;
  latitude: number;
  longitude: number;
  solar: SolarArcMetrics;
  lunar: LunarMetrics;
  fetchedAt: number;
  cachedAt: number;
  isCached: boolean;
  isStale: boolean;
}

export interface AstronomyFetchOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  referenceTime?: Date;
}

export const ASTRONOMY_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_TIMEOUT_MS = 8000;

interface CacheEntry {
  timestamp: number;
  data: AstronomyReport;
}

const astronomyCache = new Map<string, CacheEntry>();
const inFlightAstronomy = new Map<string, Promise<AstronomyReport>>();

export function getAstronomyCacheKey(lat: number, lon: number): string {
  return `astronomy-${lat.toFixed(3)}-${lon.toFixed(3)}`;
}

export function clearAstronomyCache(): void {
  astronomyCache.clear();
  inFlightAstronomy.clear();
}

/**
 * Calculates Moon illumination percentage from phase fraction (0.0 to 1.0)
 * using the geometric cosine formula.
 */
export function calculateMoonIllumination(phaseFraction: number): number {
  const f = ((phaseFraction % 1) + 1) % 1;
  const illumination = ((1 - Math.cos(f * 2 * Math.PI)) / 2) * 100;
  return Math.round(illumination);
}

/**
 * Determines exact Moon phase name and emoji from phase fraction (0.0 to 1.0).
 */
export function getMoonPhaseDetails(phaseFraction: number): { name: MoonPhaseName; emoji: string } {
  const f = ((phaseFraction % 1) + 1) % 1;

  if (f < 0.03 || f >= 0.97) {
    return { name: 'New Moon', emoji: '🌑' };
  } else if (f < 0.22) {
    return { name: 'Waxing Crescent', emoji: '🌒' };
  } else if (f < 0.28) {
    return { name: 'First Quarter', emoji: '🌓' };
  } else if (f < 0.47) {
    return { name: 'Waxing Gibbous', emoji: '🌔' };
  } else if (f < 0.53) {
    return { name: 'Full Moon', emoji: '🌕' };
  } else if (f < 0.72) {
    return { name: 'Waning Gibbous', emoji: '🌖' };
  } else if (f < 0.78) {
    return { name: 'Last Quarter', emoji: '🌗' };
  } else {
    return { name: 'Waning Crescent', emoji: '🌘' };
  }
}

/**
 * Derives comprehensive lunar cycle metrics for any given date using
 * synodic month math against the Jan 6, 2000 new moon epoch.
 */
export function calculateLunarMetrics(date: Date = new Date()): LunarMetrics {
  const diffMs = date.getTime() - LUNAR_EPOCH_MS;
  const daysSinceEpoch = diffMs / (1000 * 60 * 60 * 24);
  const cycles = daysSinceEpoch / SYNODIC_MONTH_DAYS;
  const phaseFraction = ((cycles % 1) + 1) % 1;
  const ageDays = Number((phaseFraction * SYNODIC_MONTH_DAYS).toFixed(1));
  const illuminationPercent = calculateMoonIllumination(phaseFraction);
  const { name: phaseName, emoji } = getMoonPhaseDetails(phaseFraction);

  const fracToFull = phaseFraction <= 0.5 ? 0.5 - phaseFraction : 1.5 - phaseFraction;
  const daysUntilNextFullMoon = Number((fracToFull * SYNODIC_MONTH_DAYS).toFixed(1));

  const fracToNew = 1.0 - phaseFraction;
  const daysUntilNextNewMoon = Number((fracToNew * SYNODIC_MONTH_DAYS).toFixed(1));

  return {
    phaseFraction: Number(phaseFraction.toFixed(4)),
    illuminationPercent,
    phaseName,
    emoji,
    ageDays,
    daysUntilNextFullMoon,
    daysUntilNextNewMoon,
  };
}

/**
 * Formats an ISO string (e.g. "2026-10-04T06:12") into a 12-hour time format "06:12 AM".
 */
export function formatTimeFromIso(iso: string): string {
  try {
    const parts = iso.split('T')[1]?.split(':');
    if (!parts || parts.length < 2) return iso;
    const hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour.toString().padStart(2, '0')}:${minute} ${ampm}`;
  } catch {
    return iso;
  }
}

/**
 * Formats duration in seconds into "Xh Ym".
 */
export function formatDurationSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Computes real-time solar arc progress and ephemeris details.
 */
export function calculateSolarArcProgress(
  sunriseIso: string,
  sunsetIso: string,
  durationSeconds?: number,
  referenceTime: Date = new Date()
): SolarArcMetrics {
  const sunriseDate = new Date(sunriseIso);
  const sunsetDate = new Date(sunsetIso);

  const currentMs = referenceTime.getTime();
  const sunriseMs = sunriseDate.getTime();
  const sunsetMs = sunsetDate.getTime();

  let progressPercent = 0;
  let isSunUp = false;
  let solarStatus: 'Pre-Dawn' | 'Daylight' | 'Post-Dusk' = 'Pre-Dawn';

  if (currentMs < sunriseMs) {
    progressPercent = 0;
    isSunUp = false;
    solarStatus = 'Pre-Dawn';
  } else if (currentMs > sunsetMs) {
    progressPercent = 100;
    isSunUp = false;
    solarStatus = 'Post-Dusk';
  } else {
    const totalDaylightMs = sunsetMs - sunriseMs;
    const elapsedMs = currentMs - sunriseMs;
    if (totalDaylightMs > 0) {
      progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDaylightMs) * 1000) / 10));
    }
    isSunUp = true;
    solarStatus = 'Daylight';
  }

  const effectiveDuration = durationSeconds && durationSeconds > 0
    ? durationSeconds
    : Math.max(0, Math.round((sunsetMs - sunriseMs) / 1000));

  // Solar Noon is midpoint
  const noonMs = sunriseMs + (sunsetMs - sunriseMs) / 2;
  const noonDate = new Date(noonMs);
  const noonIso = `${noonDate.getFullYear()}-${(noonDate.getMonth() + 1).toString().padStart(2, '0')}-${noonDate.getDate().toString().padStart(2, '0')}T${noonDate.getHours().toString().padStart(2, '0')}:${noonDate.getMinutes().toString().padStart(2, '0')}`;

  // Golden hours: 1h after sunrise, 1h before sunset
  const goldenMorningDate = new Date(sunriseMs + 3600 * 1000);
  const goldenMorningIso = `${goldenMorningDate.getFullYear()}-${(goldenMorningDate.getMonth() + 1).toString().padStart(2, '0')}-${goldenMorningDate.getDate().toString().padStart(2, '0')}T${goldenMorningDate.getHours().toString().padStart(2, '0')}:${goldenMorningDate.getMinutes().toString().padStart(2, '0')}`;

  const goldenEveningDate = new Date(sunsetMs - 3600 * 1000);
  const goldenEveningIso = `${goldenEveningDate.getFullYear()}-${(goldenEveningDate.getMonth() + 1).toString().padStart(2, '0')}-${goldenEveningDate.getDate().toString().padStart(2, '0')}T${goldenEveningDate.getHours().toString().padStart(2, '0')}:${goldenEveningDate.getMinutes().toString().padStart(2, '0')}`;

  return {
    sunriseTime: formatTimeFromIso(sunriseIso),
    sunsetTime: formatTimeFromIso(sunsetIso),
    sunriseIso,
    sunsetIso,
    daylightDurationSeconds: effectiveDuration,
    daylightDurationFormatted: formatDurationSeconds(effectiveDuration),
    progressPercent,
    isSunUp,
    solarStatus,
    solarNoonTime: formatTimeFromIso(noonIso),
    goldenHourMorning: formatTimeFromIso(goldenMorningIso),
    goldenHourEvening: formatTimeFromIso(goldenEveningIso),
  };
}

/**
 * Normalizes raw forecast data into AstronomyReport.
 */
export function normalizeAstronomyData(
  latitude: number,
  longitude: number,
  raw: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  referenceTime: Date = new Date()
): AstronomyReport {
  const daily = raw?.daily || {};
  const sunriseArray = Array.isArray(daily.sunrise) ? daily.sunrise : [];
  const sunsetArray = Array.isArray(daily.sunset) ? daily.sunset : [];
  const durationArray = Array.isArray(daily.daylight_duration) ? daily.daylight_duration : [];

  const sunriseIso = sunriseArray[0] || `${referenceTime.toISOString().slice(0, 10)}T06:00`;
  const sunsetIso = sunsetArray[0] || `${referenceTime.toISOString().slice(0, 10)}T18:00`;
  const durationSec = Number(durationArray[0]) || 43200;

  const solar = calculateSolarArcProgress(sunriseIso, sunsetIso, durationSec, referenceTime);
  const lunar = calculateLunarMetrics(referenceTime);

  return {
    locationId: `astro-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
    latitude,
    longitude,
    solar,
    lunar,
    fetchedAt: Date.now(),
    cachedAt: Date.now(),
    isCached: false,
    isStale: false,
  };
}

/**
 * Fetches solar ephemeris and computes astronomical metrics for given coordinates.
 */
export async function fetchAstronomyData(
  latitude: number,
  longitude: number,
  options?: AstronomyFetchOptions
): Promise<AstronomyReport> {
  const cacheKey = getAstronomyCacheKey(latitude, longitude);
  const now = Date.now();
  const cached = astronomyCache.get(cacheKey);

  // 1. Fresh Cache Hit
  if (!options?.forceRefresh && cached) {
    if (now - cached.timestamp < ASTRONOMY_CACHE_TTL_MS) {
      // Re-evaluate real-time arc progress against fresh client timestamp
      const refTime = options?.referenceTime ?? new Date();
      const updatedSolar = calculateSolarArcProgress(
        cached.data.solar.sunriseIso,
        cached.data.solar.sunsetIso,
        cached.data.solar.daylightDurationSeconds,
        refTime
      );
      return {
        ...cached.data,
        solar: updatedSolar,
        isCached: true,
        isStale: false,
      };
    }
  }

  // 2. In-Flight Request Deduplication
  if (inFlightAstronomy.has(cacheKey)) {
    return inFlightAstronomy.get(cacheKey)!;
  }

  // 3. Initiate Network Fetch
  const fetchPromise = (async (): Promise<AstronomyReport> => {
    const fetchFn = options?.fetchFn ?? fetch;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=sunrise,sunset,daylight_duration&timezone=auto`;

      const response = await fetchFn(url, { signal: options?.signal ?? controller.signal });
      if (!response.ok) {
        throw new Error(`Open-Meteo astronomy fetch failed with HTTP ${response.status}`);
      }

      const raw = await response.json();
      const report = normalizeAstronomyData(latitude, longitude, raw, options?.referenceTime ?? new Date());

      astronomyCache.set(cacheKey, {
        timestamp: Date.now(),
        data: report,
      });

      return report;
    } catch (err: unknown) {
      if (cached) {
        return {
          ...cached.data,
          isCached: true,
          isStale: true,
        };
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      inFlightAstronomy.delete(cacheKey);
    }
  })();

  inFlightAstronomy.set(cacheKey, fetchPromise);
  return fetchPromise;
}
