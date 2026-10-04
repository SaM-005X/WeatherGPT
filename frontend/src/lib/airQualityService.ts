/**
 * Air Quality Service & Environmental Health Engine
 *
 * Ingests real-time pollution metrics from the Open-Meteo Air Quality REST API,
 * normalizes US AQI, European AQI, particulate matter (PM2.5, PM10), and trace gases
 * (CO, NO2, SO2, O3), and derives EPA-standardized health categories and advisories.
 *
 * Source: Open-Meteo Air Quality API
 */

export type UsAqiCategory = 'Good' | 'Moderate' | 'Sensitive' | 'Unhealthy' | 'Hazardous';

export interface PollutantDetail {
  code: string;
  name: string;
  value: number;
  unit: string;
  category: 'Good' | 'Moderate' | 'Unhealthy' | 'Hazardous';
  description: string;
}

export interface HealthAdvisory {
  general: string;
  sensitiveGroups: string;
  outdoorActivities: string;
}

export interface AirQualityReport {
  locationId: string;
  latitude: number;
  longitude: number;
  usAqi: number;
  europeanAqi: number;
  category: UsAqiCategory;
  categoryLabel: string;
  healthAdvisory: HealthAdvisory;
  pollutants: {
    pm2_5: PollutantDetail;
    pm10: PollutantDetail;
    carbonMonoxide: PollutantDetail;
    nitrogenDioxide: PollutantDetail;
    sulphurDioxide: PollutantDetail;
    ozone: PollutantDetail;
  };
  dominantPollutant: string;
  fetchedAt: number;
  cachedAt: number;
  isCached: boolean;
  isStale: boolean;
}

export interface AirQualityFetchOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export const AIR_QUALITY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_TIMEOUT_MS = 8000;

interface CacheEntry {
  timestamp: number;
  data: AirQualityReport;
}

const airQualityCache = new Map<string, CacheEntry>();
const inFlightAirQuality = new Map<string, Promise<AirQualityReport>>();

export function getAirQualityCacheKey(lat: number, lon: number): string {
  return `air-quality-${lat.toFixed(3)}-${lon.toFixed(3)}`;
}

export function clearAirQualityCache(): void {
  airQualityCache.clear();
  inFlightAirQuality.clear();
}

/**
 * Maps US EPA AQI numeric index to standardized category.
 * Good (0-50), Moderate (51-100), Sensitive (101-150), Unhealthy (151-200), Hazardous (201+)
 */
export function getUsAqiCategory(usAqi: number): UsAqiCategory {
  if (usAqi <= 50) return 'Good';
  if (usAqi <= 100) return 'Moderate';
  if (usAqi <= 150) return 'Sensitive';
  if (usAqi <= 200) return 'Unhealthy';
  return 'Hazardous';
}

/**
 * Returns user-friendly category title.
 */
export function getCategoryLabel(category: UsAqiCategory): string {
  switch (category) {
    case 'Good':
      return 'Good';
    case 'Moderate':
      return 'Moderate';
    case 'Sensitive':
      return 'Unhealthy for Sensitive Groups';
    case 'Unhealthy':
      return 'Unhealthy';
    case 'Hazardous':
      return 'Hazardous';
  }
}

/**
 * Generates actionable EPA health advisories based on US AQI category.
 */
export function getHealthAdvisories(category: UsAqiCategory): HealthAdvisory {
  switch (category) {
    case 'Good':
      return {
        general: 'Air quality is satisfactory and poses little or no risk.',
        sensitiveGroups: 'Ideal conditions for all individuals, including children and active adults.',
        outdoorActivities: 'Great day for outdoor recreation, sports, and ventilation.',
      };
    case 'Moderate':
      return {
        general: 'Air quality is acceptable for the majority of the population.',
        sensitiveGroups: 'Unusually sensitive individuals may experience minor respiratory irritation.',
        outdoorActivities: 'Safe for normal outdoor exercise; sensitive people should monitor symptoms.',
      };
    case 'Sensitive':
      return {
        general: 'General public is not likely to experience acute health impacts.',
        sensitiveGroups: 'Individuals with asthma, lung disease, children, and the elderly are at heightened risk.',
        outdoorActivities: 'Sensitive groups should reduce prolonged or heavy outdoor exertion.',
      };
    case 'Unhealthy':
      return {
        general: 'Everyone may begin to experience noticeable health effects.',
        sensitiveGroups: 'Members of sensitive groups may experience more serious health effects.',
        outdoorActivities: 'Avoid prolonged strenuous outdoor exertion; take frequent indoor breaks.',
      };
    case 'Hazardous':
      return {
        general: 'Health warning of emergency conditions. The entire population is likely to be affected.',
        sensitiveGroups: 'Extreme danger for sensitive individuals. Keep rescue medications close at hand.',
        outdoorActivities: 'Avoid all outdoor physical activity. Keep windows and doors tightly sealed.',
      };
  }
}

/**
 * Categorizes individual pollutants against reference thresholds.
 */
function categorizePollutant(code: string, value: number): 'Good' | 'Moderate' | 'Unhealthy' | 'Hazardous' {
  switch (code) {
    case 'pm2_5':
      if (value <= 12) return 'Good';
      if (value <= 35.4) return 'Moderate';
      if (value <= 150.4) return 'Unhealthy';
      return 'Hazardous';
    case 'pm10':
      if (value <= 54) return 'Good';
      if (value <= 154) return 'Moderate';
      if (value <= 254) return 'Unhealthy';
      return 'Hazardous';
    case 'ozone':
      if (value <= 100) return 'Good';
      if (value <= 160) return 'Moderate';
      if (value <= 240) return 'Unhealthy';
      return 'Hazardous';
    case 'nitrogen_dioxide':
      if (value <= 40) return 'Good';
      if (value <= 90) return 'Moderate';
      if (value <= 180) return 'Unhealthy';
      return 'Hazardous';
    case 'sulphur_dioxide':
      if (value <= 50) return 'Good';
      if (value <= 100) return 'Moderate';
      if (value <= 350) return 'Unhealthy';
      return 'Hazardous';
    case 'carbon_monoxide':
      if (value <= 4000) return 'Good';
      if (value <= 9000) return 'Moderate';
      if (value <= 15000) return 'Unhealthy';
      return 'Hazardous';
    default:
      return 'Good';
  }
}

/**
 * Normalizes raw API response into typed AirQualityReport.
 */
export function normalizeAirQualityData(
  latitude: number,
  longitude: number,
  raw: any // eslint-disable-line @typescript-eslint/no-explicit-any
): AirQualityReport {
  const current = raw?.current || {};

  const usAqi = Math.round(Number(current.us_aqi) || 0);
  const europeanAqi = Math.round(Number(current.european_aqi) || 0);
  const pm2_5Val = Number(current.pm2_5) || 0;
  const pm10Val = Number(current.pm10) || 0;
  const coVal = Number(current.carbon_monoxide) || 0;
  const no2Val = Number(current.nitrogen_dioxide) || 0;
  const so2Val = Number(current.sulphur_dioxide) || 0;
  const o3Val = Number(current.ozone) || 0;

  const category = getUsAqiCategory(usAqi);
  const categoryLabel = getCategoryLabel(category);
  const healthAdvisory = getHealthAdvisories(category);

  // Identify dominant pollutant based on relative severity
  let dominantPollutant = 'PM2.5';
  if (pm10Val > 54 && pm10Val > pm2_5Val * 2) {
    dominantPollutant = 'PM10';
  } else if (o3Val > 100) {
    dominantPollutant = 'Ozone (O₃)';
  } else if (no2Val > 90) {
    dominantPollutant = 'Nitrogen Dioxide (NO₂)';
  }

  return {
    locationId: `aqi-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
    latitude,
    longitude,
    usAqi,
    europeanAqi,
    category,
    categoryLabel,
    healthAdvisory,
    pollutants: {
      pm2_5: {
        code: 'pm2_5',
        name: 'Fine Particulate Matter (PM2.5)',
        value: Number(pm2_5Val.toFixed(1)),
        unit: 'µg/m³',
        category: categorizePollutant('pm2_5', pm2_5Val),
        description: 'Microscopic inhalable combustion and aerosol particles penetrating deep into lungs.',
      },
      pm10: {
        code: 'pm10',
        name: 'Coarse Particulate Matter (PM10)',
        value: Number(pm10Val.toFixed(1)),
        unit: 'µg/m³',
        category: categorizePollutant('pm10', pm10Val),
        description: 'Inhalable dust, pollen, and debris irritating nasal and airway passages.',
      },
      carbonMonoxide: {
        code: 'carbon_monoxide',
        name: 'Carbon Monoxide (CO)',
        value: Math.round(coVal),
        unit: 'µg/m³',
        category: categorizePollutant('carbon_monoxide', coVal),
        description: 'Colorless, odorless gas from incomplete combustion reducing oxygen delivery.',
      },
      nitrogenDioxide: {
        code: 'nitrogen_dioxide',
        name: 'Nitrogen Dioxide (NO₂)',
        value: Number(no2Val.toFixed(1)),
        unit: 'µg/m³',
        category: categorizePollutant('nitrogen_dioxide', no2Val),
        description: 'Emissions from vehicular exhaust causing bronchial airway inflammation.',
      },
      sulphurDioxide: {
        code: 'sulphur_dioxide',
        name: 'Sulphur Dioxide (SO₂)',
        value: Number(so2Val.toFixed(1)),
        unit: 'µg/m³',
        category: categorizePollutant('sulphur_dioxide', so2Val),
        description: 'Industrial emissions and fuel burning causing respiratory irritation and acid rain.',
      },
      ozone: {
        code: 'ozone',
        name: 'Surface Ozone (O₃)',
        value: Number(o3Val.toFixed(1)),
        unit: 'µg/m³',
        category: categorizePollutant('ozone', o3Val),
        description: 'Secondary photochemical smog formed by sunlight and reactive organic emissions.',
      },
    },
    dominantPollutant,
    fetchedAt: Date.now(),
    cachedAt: Date.now(),
    isCached: false,
    isStale: false,
  };
}

/**
 * Fetches real-time Air Quality metrics for given coordinates.
 */
export async function fetchAirQuality(
  latitude: number,
  longitude: number,
  options?: AirQualityFetchOptions
): Promise<AirQualityReport> {
  const cacheKey = getAirQualityCacheKey(latitude, longitude);
  const now = Date.now();
  const cached = airQualityCache.get(cacheKey);

  // 1. Fresh Cache Hit
  if (!options?.forceRefresh && cached) {
    if (now - cached.timestamp < AIR_QUALITY_CACHE_TTL_MS) {
      return {
        ...cached.data,
        isCached: true,
        isStale: false,
      };
    }
  }

  // 2. In-Flight Request Deduplication
  if (inFlightAirQuality.has(cacheKey)) {
    return inFlightAirQuality.get(cacheKey)!;
  }

  // 3. Initiate Network Fetch
  const fetchPromise = (async (): Promise<AirQualityReport> => {
    const fetchFn = options?.fetchFn ?? fetch;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone`;

      const response = await fetchFn(url, { signal: options?.signal ?? controller.signal });
      if (!response.ok) {
        throw new Error(`Open-Meteo Air Quality fetch failed with HTTP ${response.status}`);
      }

      const raw = await response.json();
      const report = normalizeAirQualityData(latitude, longitude, raw);

      airQualityCache.set(cacheKey, {
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
      inFlightAirQuality.delete(cacheKey);
    }
  })();

  inFlightAirQuality.set(cacheKey, fetchPromise);
  return fetchPromise;
}
