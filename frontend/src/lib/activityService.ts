/**
 * Weather Activity Suitability Engine & Lifestyle Intelligence
 *
 * Evaluates 5 outdoor lifestyle activities (Running, Cycling, Hiking, Beach, Stargazing)
 * with multi-variable scoring (0-100) based on temperature, precipitation, wind speed,
 * cloud cover, relative humidity, and solar daylight status.
 *
 * Source: Open-Meteo Forecast API & Meteorological Comfort Algorithms
 */

export interface WeatherMetrics {
  tempC: number;
  precipitationMm: number;
  windSpeedKmh: number;
  cloudCoverPercent: number;
  humidityPercent: number;
  isDaylight: boolean;
}

export type ActivityId = 'running' | 'cycling' | 'hiking' | 'beach' | 'stargazing';

export type ActivityRatingTier = 'Poor' | 'Fair' | 'Good' | 'Ideal';

export interface ActivityScore {
  id: ActivityId;
  name: string;
  icon: string;
  score: number; // 0 - 100
  tier: ActivityRatingTier;
  summary: string;
  positiveDrivers: string[];
  negativeDrivers: string[];
  idealConditions: string;
}

export interface ActivityEvaluationReport {
  locationId: string;
  latitude: number;
  longitude: number;
  metrics: WeatherMetrics;
  activities: Record<ActivityId, ActivityScore>;
  activityList: ActivityScore[];
  bestActivity: ActivityScore;
  fetchedAt: number;
  cachedAt: number;
  isCached: boolean;
  isStale: boolean;
}

export interface ActivityFetchOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  customMetrics?: WeatherMetrics;
}

export const ACTIVITY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_TIMEOUT_MS = 8000;

interface CacheEntry {
  timestamp: number;
  data: ActivityEvaluationReport;
}

const activityCache = new Map<string, CacheEntry>();
const inFlightActivities = new Map<string, Promise<ActivityEvaluationReport>>();

export function getActivityCacheKey(lat: number, lon: number): string {
  return `activity-${lat.toFixed(3)}-${lon.toFixed(3)}`;
}

export function clearActivityCache(): void {
  activityCache.clear();
  inFlightActivities.clear();
}

/**
 * Categorizes a 0-100 numeric score into standardized tiers:
 * Poor (<40), Fair (40-59), Good (60-79), Ideal (80-100).
 */
export function getRatingTier(score: number): ActivityRatingTier {
  if (score >= 80) return 'Ideal';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

/**
 * 1. Running & Jogging Evaluator
 * Ideal: 12-20°C, zero rain, light wind (<15 km/h)
 */
export function evaluateRunning(metrics: WeatherMetrics): ActivityScore {
  let score = 100;
  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  // Temperature
  if (metrics.tempC >= 12 && metrics.tempC <= 20) {
    positiveDrivers.push('Optimal running temperature (12–20°C) with low cardiovascular heat stress.');
  } else if (metrics.tempC > 20 && metrics.tempC <= 25) {
    score -= 10;
    positiveDrivers.push('Pleasant conditions; slightly elevated sweat rate.');
  } else if (metrics.tempC > 25 && metrics.tempC <= 30) {
    score -= 25;
    negativeDrivers.push('Warm temperatures (25–30°C); increase hydration frequency.');
  } else if (metrics.tempC > 30) {
    score -= 45;
    negativeDrivers.push('Excessive heat (>30°C); significant risk of heat exhaustion and cramps.');
  } else if (metrics.tempC >= 5 && metrics.tempC < 12) {
    score -= 10;
    positiveDrivers.push('Crisp, cool air; light technical running layers suggested.');
  } else if (metrics.tempC >= 0 && metrics.tempC < 5) {
    score -= 25;
    negativeDrivers.push('Cold conditions near freezing; thermal gloves and warm base layer required.');
  } else {
    score -= 50;
    negativeDrivers.push('Sub-zero freezing temperatures; risk of slippery black ice and airway chill.');
  }

  // Precipitation
  if (metrics.precipitationMm === 0) {
    positiveDrivers.push('Dry ground conditions ensuring reliable shoe grip and footing.');
  } else if (metrics.precipitationMm <= 1.0) {
    score -= 20;
    negativeDrivers.push('Light drizzle creates damp pavement and minor slip risk.');
  } else if (metrics.precipitationMm <= 4.0) {
    score -= 45;
    negativeDrivers.push('Moderate rainfall soaking gear and impairing visibility.');
  } else {
    score -= 75;
    negativeDrivers.push('Heavy downpour with pooling surface water; outdoor running not recommended.');
  }

  // Wind
  if (metrics.windSpeedKmh <= 15) {
    positiveDrivers.push('Gentle wind with negligible aerodynamic resistance.');
  } else if (metrics.windSpeedKmh <= 25) {
    score -= 10;
  } else if (metrics.windSpeedKmh <= 40) {
    score -= 25;
    negativeDrivers.push('Brisk headwind (>25 km/h) demanding extra aerobic output.');
  } else {
    score -= 50;
    negativeDrivers.push('Strong wind gusts (>40 km/h) disrupting running cadence and balance.');
  }

  // Humidity & Heat penalty
  if (metrics.tempC > 22 && metrics.humidityPercent > 75) {
    score -= 15;
    negativeDrivers.push('Muggy humidity inhibits body sweat evaporation.');
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));
  const tier = getRatingTier(finalScore);

  let summary = 'Ideal conditions for your outdoor run.';
  if (tier === 'Good') summary = 'Good conditions for a jog, with manageable weather factors.';
  else if (tier === 'Fair') summary = 'Fair conditions; dress appropriately and prepare for minor resistance.';
  else if (tier === 'Poor') summary = 'Unfavorable running weather. Consider treadmill or indoor workouts.';

  return {
    id: 'running',
    name: 'Running & Jogging',
    icon: '🏃',
    score: finalScore,
    tier,
    summary,
    positiveDrivers,
    negativeDrivers,
    idealConditions: '12–20°C, zero rain, wind < 15 km/h',
  };
}

/**
 * 2. Cycling Evaluator
 * Ideal: moderate temp (15-25°C), wind < 25 km/h, dry surface
 */
export function evaluateCycling(metrics: WeatherMetrics): ActivityScore {
  let score = 100;
  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  // Wind (primary safety & drag variable for cyclists)
  if (metrics.windSpeedKmh <= 15) {
    positiveDrivers.push('Light breeze provides smooth, aerodynamic riding stability.');
  } else if (metrics.windSpeedKmh <= 25) {
    score -= 12;
    positiveDrivers.push('Moderate wind; manageable with steady gear selection.');
  } else if (metrics.windSpeedKmh <= 35) {
    score -= 30;
    negativeDrivers.push('Gusty winds (25–35 km/h) requiring firm handlebar control on crosswinds.');
  } else if (metrics.windSpeedKmh <= 50) {
    score -= 55;
    negativeDrivers.push('Strong winds (>35 km/h) causing bike destabilization and heavy drag.');
  } else {
    score -= 85;
    negativeDrivers.push('Gale force gusts (>50 km/h); severe crash and tipping hazard.');
  }

  // Precipitation (braking & tire traction)
  if (metrics.precipitationMm === 0) {
    positiveDrivers.push('Dry road surface ensuring full brake modulation and cornering tire traction.');
  } else if (metrics.precipitationMm <= 1.0) {
    score -= 30;
    negativeDrivers.push('Wet asphalt extends braking distance and makes road paint/manholes slick.');
  } else {
    score -= 65;
    negativeDrivers.push('Active rain spray and soaked rims severely reduce braking power.');
  }

  // Temperature
  if (metrics.tempC >= 15 && metrics.tempC <= 25) {
    positiveDrivers.push('Optimal cycling comfort temperature (15–25°C).');
  } else if (metrics.tempC >= 10 && metrics.tempC < 15) {
    score -= 10;
    positiveDrivers.push('Cool air temperature; windproof cycling vest recommended.');
  } else if (metrics.tempC >= 5 && metrics.tempC < 10) {
    score -= 25;
    negativeDrivers.push('Chilly windchill on exposed fingers, toes, and face.');
  } else if (metrics.tempC < 5) {
    score -= 50;
    negativeDrivers.push('Freezing road windchill; risk of icy patches in shaded corners.');
  } else if (metrics.tempC > 25 && metrics.tempC <= 32) {
    score -= 15;
    negativeDrivers.push('Warm sun; carry extra water bottles to prevent dehydration.');
  } else {
    score -= 45;
    negativeDrivers.push('Intense heat (>32°C) escalating heat stroke risk during sustained climbs.');
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));
  const tier = getRatingTier(finalScore);

  let summary = 'Superb cycling conditions with dry roads and mild wind.';
  if (tier === 'Good') summary = 'Favorable ride conditions; heed crosswinds and hydrate.';
  else if (tier === 'Fair') summary = 'Challenging ride; watch road traction and headwind gusts.';
  else if (tier === 'Poor') summary = 'Hazardous cycling conditions due to wind, rain, or extreme cold.';

  return {
    id: 'cycling',
    name: 'Cycling & Road Biking',
    icon: '🚴',
    score: finalScore,
    tier,
    summary,
    positiveDrivers,
    negativeDrivers,
    idealConditions: '15–25°C, wind < 20 km/h, zero precipitation',
  };
}

/**
 * 3. Hiking & Walking Evaluator
 * Ideal: dry, mild temp (14-23°C), daylight
 */
export function evaluateHiking(metrics: WeatherMetrics): ActivityScore {
  let score = 100;
  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  // Daylight
  if (metrics.isDaylight) {
    positiveDrivers.push('Natural daylight provides clear trail visibility and safe route navigation.');
  } else {
    score -= 35;
    negativeDrivers.push('Nighttime darkness increases tripping and trail disorientation hazards; headlamp required.');
  }

  // Precipitation (mud, slippery boulders, flash risks)
  if (metrics.precipitationMm === 0) {
    positiveDrivers.push('Dry trail paths with secure footing on dirt and rock scrambles.');
  } else if (metrics.precipitationMm <= 1.0) {
    score -= 25;
    negativeDrivers.push('Drizzle causes muddy patches and slippery wet tree roots.');
  } else {
    score -= 60;
    negativeDrivers.push('Rain saturates trails, swells stream crossings, and creates slick rock hazards.');
  }

  // Temperature
  if (metrics.tempC >= 14 && metrics.tempC <= 23) {
    positiveDrivers.push('Pleasant, mild ambient temperature for mountain hiking.');
  } else if (metrics.tempC > 23 && metrics.tempC <= 28) {
    score -= 10;
    positiveDrivers.push('Warm ascent weather; pack a sun hat and sun protection.');
  } else if (metrics.tempC > 28) {
    score -= 35;
    negativeDrivers.push('High thermal exposure (>28°C); steep climbs risk dehydration.');
  } else if (metrics.tempC >= 5 && metrics.tempC < 14) {
    score -= 10;
    positiveDrivers.push('Brisk mountain air; pack an insulating mid-layer.');
  } else {
    score -= 35;
    negativeDrivers.push('Near-freezing trail temperatures; pack winter emergency gear.');
  }

  // Wind
  if (metrics.windSpeedKmh <= 20) {
    positiveDrivers.push('Calm conditions across exposed ridges and scenic view-points.');
  } else if (metrics.windSpeedKmh <= 40) {
    score -= 20;
    negativeDrivers.push('Breezy on exposed ridges and high summits.');
  } else {
    score -= 50;
    negativeDrivers.push('High winds (>40 km/h) creating dangerous buffeting along exposed cliff edges.');
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));
  const tier = getRatingTier(finalScore);

  let summary = 'Ideal weather for trail hiking and nature walks.';
  if (tier === 'Good') summary = 'Good hiking weather; dress in layers and carry water.';
  else if (tier === 'Fair') summary = 'Marginal conditions; monitor wet trails and weather shifts.';
  else if (tier === 'Poor') summary = 'Unsafe hiking conditions due to rain, darkness, or gale winds.';

  return {
    id: 'hiking',
    name: 'Hiking & Walking',
    icon: '🥾',
    score: finalScore,
    tier,
    summary,
    positiveDrivers,
    negativeDrivers,
    idealConditions: '14–23°C, daylight, dry ground, wind < 20 km/h',
  };
}

/**
 * 4. Beach & Swimming Evaluator
 * Ideal: temp > 22°C (25-32°C optimal), low wind (<20 km/h), clear skies
 */
export function evaluateBeach(metrics: WeatherMetrics): ActivityScore {
  let score = 100;
  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  // Daylight
  if (!metrics.isDaylight) {
    score -= 65;
    negativeDrivers.push('Nighttime darkness; lifeguards off duty and no sunbathing.');
  } else {
    positiveDrivers.push('Full daylight for swimming and shoreline sunbathing.');
  }

  // Temperature
  if (metrics.tempC >= 25 && metrics.tempC <= 34) {
    positiveDrivers.push('Warm, summery ambient temperatures (25–34°C) ideal for swimwear.');
  } else if (metrics.tempC >= 22 && metrics.tempC < 25) {
    score -= 15;
    positiveDrivers.push('Pleasant warmth; ocean or lake water may feel slightly brisk.');
  } else if (metrics.tempC >= 18 && metrics.tempC < 22) {
    score -= 40;
    negativeDrivers.push('Cool weather (18–22°C); too brisk for comfortable sunbathing or casual swimming.');
  } else if (metrics.tempC < 18) {
    score -= 75;
    negativeDrivers.push('Cold temperatures (<18°C) completely unsuitable for beach swimming.');
  } else {
    score -= 15;
    negativeDrivers.push('Very hot (>34°C); seek shade and apply SPF 50+ sunscreen.');
  }

  // Cloud Cover
  if (metrics.cloudCoverPercent <= 25) {
    positiveDrivers.push('Clear sunny skies with radiant sunshine.');
  } else if (metrics.cloudCoverPercent <= 60) {
    score -= 10;
    positiveDrivers.push('Partly cloudy with pleasant intermittent sun breaks.');
  } else {
    score -= 35;
    negativeDrivers.push('Overcast cloud cover suppresses warmth and sunbathing brightness.');
  }

  // Precipitation
  if (metrics.precipitationMm > 0) {
    score -= 65;
    negativeDrivers.push('Active rain ruins beach towels and seaside relaxation.');
  }

  // Wind
  if (metrics.windSpeedKmh <= 18) {
    positiveDrivers.push('Gentle sea breeze with calm coastal surf.');
  } else if (metrics.windSpeedKmh <= 30) {
    score -= 20;
    negativeDrivers.push('Brisk onshore wind blowing loose beach sand.');
  } else {
    score -= 50;
    negativeDrivers.push('High winds (>30 km/h) generating choppy water, rip currents, and sandblasts.');
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));
  const tier = getRatingTier(finalScore);

  let summary = 'Prime beach weather! Grab your sunscreen and swimwear.';
  if (tier === 'Good') summary = 'Enjoyable beach day; bring a light cover-up for passing clouds.';
  else if (tier === 'Fair') summary = 'Marginal beach weather; comfortable for coastal walking only.';
  else if (tier === 'Poor') summary = 'Unfavorable beach conditions due to cold, rain, wind, or darkness.';

  return {
    id: 'beach',
    name: 'Beach & Swimming',
    icon: '🏖️',
    score: finalScore,
    tier,
    summary,
    positiveDrivers,
    negativeDrivers,
    idealConditions: 'Temp > 24°C, sunny (<30% clouds), wind < 20 km/h, daylight',
  };
}

/**
 * 5. Stargazing Evaluator
 * Ideal: night only (isDaylight = false), cloud cover < 20%, low humidity, zero rain
 */
export function evaluateStargazing(metrics: WeatherMetrics): ActivityScore {
  // Daylight prevents astronomical stargazing completely
  if (metrics.isDaylight) {
    return {
      id: 'stargazing',
      name: 'Stargazing & Astronomy',
      icon: '✨',
      score: 0,
      tier: 'Poor',
      summary: 'Daylight washes out stars and deep-sky objects. Plan for after dusk.',
      positiveDrivers: [],
      negativeDrivers: [
        'Daylight completely washes out celestial observation.',
        'Wait until astronomical dusk / true night for stellar visibility.',
      ],
      idealConditions: 'Night only, cloud cover < 20%, low humidity, zero rain',
    };
  }

  let score = 100;
  const positiveDrivers: string[] = ['Nighttime darkness enables dark-sky celestial observation.'];
  const negativeDrivers: string[] = [];

  // Cloud Cover (the cardinal astronomical metric)
  if (metrics.cloudCoverPercent <= 15) {
    positiveDrivers.push('Crystal clear skies offering unimpeded stellar transparency.');
  } else if (metrics.cloudCoverPercent <= 30) {
    score -= 20;
    negativeDrivers.push('Scattered clouds (15–30%) intermittently drifting across target constellations.');
  } else if (metrics.cloudCoverPercent <= 65) {
    score -= 55;
    negativeDrivers.push('Moderate cloud cover (30–65%) obscuring major planetary and nebular features.');
  } else {
    score -= 85;
    negativeDrivers.push('Overcast cloud blanket completely hiding celestial bodies.');
  }

  // Precipitation
  if (metrics.precipitationMm > 0) {
    score -= 85;
    negativeDrivers.push('Precipitation prevents outdoor optical equipment and telescope use.');
  }

  // Humidity (atmospheric transparency & dew formation)
  if (metrics.humidityPercent <= 65) {
    positiveDrivers.push('Low relative humidity ensures crisp contrast and minimal lens dew.');
  } else if (metrics.humidityPercent <= 80) {
    score -= 12;
    negativeDrivers.push('Moderate atmospheric moisture; keep dew shields on lenses.');
  } else {
    score -= 30;
    negativeDrivers.push('High humidity (>80%) creates optical haze and rapid condensation on mirrors.');
  }

  // Wind (telescope mount stability)
  if (metrics.windSpeedKmh <= 15) {
    positiveDrivers.push('Calm air keeps telescope mounts and tripods vibration-free.');
  } else if (metrics.windSpeedKmh <= 30) {
    score -= 15;
    negativeDrivers.push('Breeze causes minor telescope vibration during high-magnification viewing.');
  } else {
    score -= 35;
    negativeDrivers.push('Gusty winds destabilize optical mounts and induce shivering.');
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));
  const tier = getRatingTier(finalScore);

  let summary = 'Pristine dark sky! Outstanding visibility for stars, planets, and the Milky Way.';
  if (tier === 'Good') summary = 'Good night for observing bright planets, lunar craters, and constellations.';
  else if (tier === 'Fair') summary = 'Fair conditions; passing clouds or haze will test viewing patience.';
  else if (tier === 'Poor') summary = 'Poor astronomical seeing due to heavy cloud cover or rain.';

  return {
    id: 'stargazing',
    name: 'Stargazing & Astronomy',
    icon: '✨',
    score: finalScore,
    tier,
    summary,
    positiveDrivers,
    negativeDrivers,
    idealConditions: 'Night only, cloud cover < 20%, low humidity, zero rain',
  };
}

/**
 * Evaluates all 5 outdoor lifestyle activities against the provided weather metrics.
 */
export function evaluateAllActivities(metrics: WeatherMetrics): Record<ActivityId, ActivityScore> {
  return {
    running: evaluateRunning(metrics),
    cycling: evaluateCycling(metrics),
    hiking: evaluateHiking(metrics),
    beach: evaluateBeach(metrics),
    stargazing: evaluateStargazing(metrics),
  };
}

/**
 * Normalizes raw forecast data into an ActivityEvaluationReport.
 */
export function normalizeActivityData(
  latitude: number,
  longitude: number,
  raw: any // eslint-disable-line @typescript-eslint/no-explicit-any
): ActivityEvaluationReport {
  const current = raw?.current || {};

  const tempC = Number(current.temperature_2m) || 20;
  const humidityPercent = Number(current.relative_humidity_2m) || 50;
  const precipitationMm = Number(current.precipitation) || 0;
  const cloudCoverPercent = Number(current.cloud_cover) || 20;
  const windSpeedKmh = Number(current.wind_speed_10m) || 12;
  const isDaylight = current.is_day === 1 || current.is_day === undefined;

  const metrics: WeatherMetrics = {
    tempC,
    precipitationMm,
    windSpeedKmh,
    cloudCoverPercent,
    humidityPercent,
    isDaylight,
  };

  const activities = evaluateAllActivities(metrics);
  const activityList = [
    activities.running,
    activities.cycling,
    activities.hiking,
    activities.beach,
    activities.stargazing,
  ];

  // Pick the highest scoring activity
  const sorted = [...activityList].sort((a, b) => b.score - a.score);
  const bestActivity = sorted[0];

  return {
    locationId: `activities-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
    latitude,
    longitude,
    metrics,
    activities,
    activityList,
    bestActivity,
    fetchedAt: Date.now(),
    cachedAt: Date.now(),
    isCached: false,
    isStale: false,
  };
}

/**
 * Fetches current weather metrics and evaluates activity suitability for coordinates.
 */
export async function fetchActivitySuitability(
  latitude: number,
  longitude: number,
  options?: ActivityFetchOptions
): Promise<ActivityEvaluationReport> {
  // If custom metrics are passed directly, evaluate synchronously without network
  if (options?.customMetrics) {
    const metrics = options.customMetrics;
    const activities = evaluateAllActivities(metrics);
    const activityList = [
      activities.running,
      activities.cycling,
      activities.hiking,
      activities.beach,
      activities.stargazing,
    ];
    const sorted = [...activityList].sort((a, b) => b.score - a.score);

    return {
      locationId: `activities-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
      latitude,
      longitude,
      metrics,
      activities,
      activityList,
      bestActivity: sorted[0],
      fetchedAt: Date.now(),
      cachedAt: Date.now(),
      isCached: false,
      isStale: false,
    };
  }

  const cacheKey = getActivityCacheKey(latitude, longitude);
  const now = Date.now();
  const cached = activityCache.get(cacheKey);

  // 1. Fresh Cache Hit
  if (!options?.forceRefresh && cached) {
    if (now - cached.timestamp < ACTIVITY_CACHE_TTL_MS) {
      return {
        ...cached.data,
        isCached: true,
        isStale: false,
      };
    }
  }

  // 2. In-Flight Request Deduplication
  if (inFlightActivities.has(cacheKey)) {
    return inFlightActivities.get(cacheKey)!;
  }

  // 3. Initiate Network Fetch
  const fetchPromise = (async (): Promise<ActivityEvaluationReport> => {
    const fetchFn = options?.fetchFn ?? fetch;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,is_day&timezone=auto`;

      const response = await fetchFn(url, { signal: options?.signal ?? controller.signal });
      if (!response.ok) {
        throw new Error(`Open-Meteo activity fetch failed with HTTP ${response.status}`);
      }

      const raw = await response.json();
      const report = normalizeActivityData(latitude, longitude, raw);

      activityCache.set(cacheKey, {
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
      inFlightActivities.delete(cacheKey);
    }
  })();

  inFlightActivities.set(cacheKey, fetchPromise);
  return fetchPromise;
}
