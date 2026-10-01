/**
 * Severe Weather Alerts Service
 *
 * Provides real-time meteorological alerts, advisories, and watches.
 * Aggregates:
 * 1. NOAA / US National Weather Service (NWS) GeoJSON API for US coordinates.
 * 2. Open-Meteo Synoptic Meteorological Thresholds for international coordinates or fallback.
 *
 * Features:
 * - 5-minute memory cache
 * - In-flight deduplication
 * - Stale-while-revalidate fallback on network drop
 * - Normalized alert severity and actionable instructions
 */

export type AlertSeverity = 'Extreme' | 'Severe' | 'Moderate' | 'Minor';
export type AlertUrgency = 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';

export interface WeatherAlert {
  id: string;
  event: string;
  severity: AlertSeverity;
  urgency: AlertUrgency;
  headline: string;
  description: string;
  instruction?: string;
  effective: string;
  expires: string;
  areaDesc?: string;
  source: string;
}

export interface AlertsReport {
  locationId: string;
  alerts: WeatherAlert[];
  fetchedAt: number;
  cachedAt: number;
  isCached: boolean;
  isStale: boolean;
  activeCount: number;
}

export interface AlertsFetchOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export const ALERTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_TIMEOUT_MS = 8000;

interface CacheEntry {
  timestamp: number;
  data: AlertsReport;
}

const alertsCache = new Map<string, CacheEntry>();
const inFlightAlerts = new Map<string, Promise<AlertsReport>>();

export function getAlertsCacheKey(lat: number, lon: number): string {
  return `alerts-${lat.toFixed(3)}-${lon.toFixed(3)}`;
}

export function clearAlertsCache(): void {
  alertsCache.clear();
  inFlightAlerts.clear();
}

/**
 * Validates coordinate inputs.
 */
function validateCoords(latitude: number, longitude: number): void {
  if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`Invalid latitude (${latitude}): Must be a valid number between -90 and 90.`);
  }
  if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`Invalid longitude (${longitude}): Must be a valid number between -180 and 180.`);
  }
}

/**
 * Determines whether coordinates fall within United States geographical bounds.
 */
export function isUnitedStates(lat: number, lon: number): boolean {
  // Continental US
  if (lat >= 24.3 && lat <= 49.5 && lon >= -125.0 && lon <= -66.9) return true;
  // Alaska
  if (lat >= 51.0 && lat <= 71.5 && lon >= -170.0 && lon <= -130.0) return true;
  // Hawaii
  if (lat >= 18.8 && lat <= 22.5 && lon >= -160.5 && lon <= -154.5) return true;
  return false;
}

/**
 * Normalizes NWS severity string into standard application enum.
 */
export function normalizeNwsSeverity(raw?: string): AlertSeverity {
  switch (raw?.toLowerCase()) {
    case 'extreme':
      return 'Extreme';
    case 'severe':
      return 'Severe';
    case 'moderate':
      return 'Moderate';
    case 'minor':
    default:
      return 'Minor';
  }
}

/**
 * Normalizes NWS urgency string into standard application enum.
 */
export function normalizeNwsUrgency(raw?: string): AlertUrgency {
  switch (raw?.toLowerCase()) {
    case 'immediate':
      return 'Immediate';
    case 'expected':
      return 'Expected';
    case 'future':
      return 'Future';
    case 'past':
      return 'Past';
    default:
      return 'Unknown';
  }
}

/**
 * Fetches active NWS alerts for US coordinates.
 */
async function fetchNwsAlerts(
  lat: number,
  lon: number,
  fetchFn: typeof fetch,
  signal?: AbortSignal
): Promise<WeatherAlert[]> {
  const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;

  const response = await fetchFn(url, {
    signal,
    headers: {
      Accept: 'application/geo+json',
      'User-Agent': '(WeatherGPT-Web, weathergpt-contact@local.internal)',
    },
  });

  if (!response.ok) {
    throw new Error(`NOAA NWS API returned HTTP ${response.status}`);
  }

  const json = await response.json();
  const features = json?.features;

  if (!Array.isArray(features)) {
    return [];
  }

  return features.map((feat: unknown, idx: number) => {
    const featureObj = feat && typeof feat === 'object' ? (feat as Record<string, unknown>) : {};
    const props =
      featureObj.properties && typeof featureObj.properties === 'object'
        ? (featureObj.properties as Record<string, unknown>)
        : {};

    const id = typeof props.id === 'string' ? props.id : `nws-${lat.toFixed(3)}-${lon.toFixed(3)}-${idx}`;
    const event = typeof props.event === 'string' ? props.event : 'Weather Advisory';
    const rawSeverity = typeof props.severity === 'string' ? props.severity : undefined;
    const rawUrgency = typeof props.urgency === 'string' ? props.urgency : undefined;
    const headline = typeof props.headline === 'string' ? props.headline : event;
    const description =
      typeof props.description === 'string'
        ? props.description
        : 'No detailed meteorological description provided.';
    const instruction = typeof props.instruction === 'string' ? props.instruction : undefined;
    const effective = typeof props.effective === 'string' ? props.effective : new Date().toISOString();
    const expires =
      typeof props.expires === 'string'
        ? props.expires
        : new Date(Date.now() + 6 * 3600 * 1000).toISOString();
    const areaDesc = typeof props.areaDesc === 'string' ? props.areaDesc : undefined;

    return {
      id,
      event,
      severity: normalizeNwsSeverity(rawSeverity),
      urgency: normalizeNwsUrgency(rawUrgency),
      headline,
      description,
      instruction,
      effective,
      expires,
      areaDesc,
      source: 'NOAA / National Weather Service',
    };
  });
}

/**
 * Synthesizes meteorological warnings from Open-Meteo current & hourly parameters
 * when outside the US or as a robust fallback.
 */
async function fetchOpenMeteoAlerts(
  lat: number,
  lon: number,
  fetchFn: typeof fetch,
  signal?: AbortSignal
): Promise<WeatherAlert[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation&hourly=weather_code,wind_speed_10m,wind_gusts_10m,precipitation&forecast_days=1&timezone=auto`;

  const response = await fetchFn(url, { signal });
  if (!response.ok) {
    throw new Error(`Open-Meteo alerts fallback HTTP ${response.status}`);
  }

  const data = await response.json();
  const current = data?.current;
  if (!current) return [];

  const alerts: WeatherAlert[] = [];
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + 4 * 3600 * 1000).toISOString();
  const weatherCode = Number(current.weather_code) || 0;
  const gusts = Number(current.wind_gusts_10m) || 0;
  const precip = Number(current.precipitation) || 0;
  const temp = Number(current.temperature_2m) || 0;

  // 1. Severe Thunderstorm & Convective Hazards (WMO codes 95, 96, 99)
  if (weatherCode === 99) {
    alerts.push({
      id: `wmo-99-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      event: 'Severe Thunderstorm & Hail Warning',
      severity: 'Severe',
      urgency: 'Immediate',
      headline: 'Severe Thunderstorm with Damaging Hail Observed',
      description: 'Intense atmospheric convective column producing heavy hail, severe electrical activity, and dangerous convective gusts.',
      instruction: 'Seek sturdy shelter immediately. Stay clear of windows and avoid travel until storm cell passes.',
      effective: nowIso,
      expires: expiresIso,
      source: 'Open-Meteo Synoptic Hazard Network',
    });
  } else if (weatherCode === 96) {
    alerts.push({
      id: `wmo-96-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      event: 'Thunderstorm & Hail Advisory',
      severity: 'Moderate',
      urgency: 'Expected',
      headline: 'Thunderstorm with Small Hail in Area',
      description: 'Convective cell producing moderate electrical activity with localized small hail and gusty winds.',
      instruction: 'Remain alert and move indoors if lightning is seen or thunder heard.',
      effective: nowIso,
      expires: expiresIso,
      source: 'Open-Meteo Synoptic Hazard Network',
    });
  } else if (weatherCode === 95) {
    alerts.push({
      id: `wmo-95-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      event: 'Thunderstorm Advisory',
      severity: 'Moderate',
      urgency: 'Expected',
      headline: 'Active Thunderstorm Observed',
      description: 'Atmospheric instability producing convective lightning discharges and sudden squally winds.',
      instruction: 'Avoid open high ground, water bodies, and isolated tall trees.',
      effective: nowIso,
      expires: expiresIso,
      source: 'Open-Meteo Synoptic Hazard Network',
    });
  }

  // 2. Gale-force Wind Warning / Wind Advisory
  if (gusts >= 75) {
    alerts.push({
      id: `wind-gale-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      event: 'High Wind / Gale Warning',
      severity: 'Severe',
      urgency: 'Immediate',
      headline: `Severe Wind Gusts Reaching ${Math.round(gusts)} km/h`,
      description: `High-velocity wind gusts of ${Math.round(gusts)} km/h detected. May cause structural damage, down power lines, and topple trees.`,
      instruction: 'Secure outdoor items, park vehicles away from trees, and avoid unnecessary travel.',
      effective: nowIso,
      expires: expiresIso,
      source: 'Open-Meteo Synoptic Hazard Network',
    });
  } else if (gusts >= 55) {
    alerts.push({
      id: `wind-advisory-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      event: 'Wind Advisory',
      severity: 'Moderate',
      urgency: 'Expected',
      headline: `Gusty Winds Up to ${Math.round(gusts)} km/h`,
      description: `Brisk to near-gale wind gusts of ${Math.round(gusts)} km/h observed in the regional surface layer.`,
      instruction: 'Use caution when operating high-profile vehicles on exposed bridges and roadways.',
      effective: nowIso,
      expires: expiresIso,
      source: 'Open-Meteo Synoptic Hazard Network',
    });
  }

  // 3. Heavy Precipitation / Torrential Downpour
  if (precip >= 15 || weatherCode === 82 || weatherCode === 65) {
    alerts.push({
      id: `rain-warning-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      event: 'Heavy Rain & Flash Flood Watch',
      severity: precip >= 25 ? 'Severe' : 'Moderate',
      urgency: 'Immediate',
      headline: `Intense Rainfall Rate (${precip.toFixed(1)} mm/h)`,
      description: 'Persistent heavy downpour creating rapid runoff and potential localized waterlogging or flash flooding.',
      instruction: 'Do not drive through flooded roadways. Keep clear of drainage ditches and low-lying underpasses.',
      effective: nowIso,
      expires: expiresIso,
      source: 'Open-Meteo Synoptic Hazard Network',
    });
  }

  // 4. Extreme Heat / Cold
  if (temp >= 40) {
    alerts.push({
      id: `temp-extreme-heat-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      event: 'Excessive Heat Warning',
      severity: 'Extreme',
      urgency: 'Immediate',
      headline: `Dangerous Extreme Heat (${temp.toFixed(1)}°C)`,
      description: 'Prolonged extreme ambient temperatures significantly elevate the risk of heat exhaustion and heat stroke.',
      instruction: 'Stay hydrated, remain in air-conditioned environments, and never leave children or pets in unattended vehicles.',
      effective: nowIso,
      expires: expiresIso,
      source: 'Open-Meteo Synoptic Hazard Network',
    });
  } else if (temp >= 35) {
    alerts.push({
      id: `temp-heat-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      event: 'Heat Advisory',
      severity: 'Moderate',
      urgency: 'Expected',
      headline: `Elevated Heat Conditions (${temp.toFixed(1)}°C)`,
      description: 'High daytime temperatures require precautions during prolonged outdoor exertion.',
      instruction: 'Drink plenty of water and schedule strenuous activities for early morning or evening hours.',
      effective: nowIso,
      expires: expiresIso,
      source: 'Open-Meteo Synoptic Hazard Network',
    });
  } else if (temp <= -15) {
    alerts.push({
      id: `temp-extreme-cold-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      event: 'Extreme Cold Warning',
      severity: 'Severe',
      urgency: 'Immediate',
      headline: `Severe Freezing Temperatures (${temp.toFixed(1)}°C)`,
      description: 'Sub-zero temperatures capable of inducing frostbite on exposed skin within 15 minutes and hypothermia.',
      instruction: 'Dress in layered warm clothing, cover exposed skin, and protect household plumbing from freezing.',
      effective: nowIso,
      expires: expiresIso,
      source: 'Open-Meteo Synoptic Hazard Network',
    });
  }

  return alerts;
}

/**
 * Fetches active meteorological alerts with caching and request deduplication.
 */
export async function fetchWeatherAlerts(
  latitude: number,
  longitude: number,
  options?: AlertsFetchOptions
): Promise<AlertsReport> {
  validateCoords(latitude, longitude);

  const cacheKey = getAlertsCacheKey(latitude, longitude);
  const now = Date.now();
  const cached = alertsCache.get(cacheKey);

  // 1. Fresh Cache Hit
  if (!options?.forceRefresh && cached) {
    if (now - cached.timestamp < ALERTS_CACHE_TTL_MS) {
      return {
        ...cached.data,
        isCached: true,
        isStale: false,
      };
    }
  }

  // 2. Return In-Flight Request
  if (inFlightAlerts.has(cacheKey)) {
    return inFlightAlerts.get(cacheKey)!;
  }

  // 3. Initiate Network Fetch
  const fetchPromise = (async (): Promise<AlertsReport> => {
    const fetchFn = options?.fetchFn ?? fetch;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let alerts: WeatherAlert[] = [];

      if (isUnitedStates(latitude, longitude)) {
        try {
          alerts = await fetchNwsAlerts(latitude, longitude, fetchFn, controller.signal);
        } catch {
          // If NWS fails, seamlessly fallback to Open-Meteo synoptic analysis
          alerts = await fetchOpenMeteoAlerts(latitude, longitude, fetchFn, controller.signal);
        }
      } else {
        alerts = await fetchOpenMeteoAlerts(latitude, longitude, fetchFn, controller.signal);
      }

      // Sort alerts by severity (Extreme -> Severe -> Moderate -> Minor)
      const severityRank: Record<AlertSeverity, number> = {
        Extreme: 4,
        Severe: 3,
        Moderate: 2,
        Minor: 1,
      };
      alerts.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

      const report: AlertsReport = {
        locationId: `coords-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
        alerts,
        fetchedAt: Date.now(),
        cachedAt: Date.now(),
        isCached: false,
        isStale: false,
        activeCount: alerts.length,
      };

      alertsCache.set(cacheKey, {
        timestamp: Date.now(),
        data: report,
      });

      return report;
    } catch (err: unknown) {
      // 4. Stale Fallback
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
      inFlightAlerts.delete(cacheKey);
    }
  })();

  inFlightAlerts.set(cacheKey, fetchPromise);
  return fetchPromise;
}
