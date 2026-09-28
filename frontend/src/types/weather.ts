/**
 * Weather data models.
 * Designed to map cleanly to future GraphQL currentWeather, todayForecast, sevenDayForecast.
 */

export type UnitSystem = 'metric' | 'imperial';

export type WeatherCondition =
  | 'CLEAR'
  | 'PARTLY_CLOUDY'
  | 'OVERCAST'
  | 'FOG'
  | 'DRIZZLE'
  | 'RAIN'
  | 'HEAVY_RAIN'
  | 'SNOW'
  | 'THUNDERSTORM'
  | 'UNKNOWN';

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  condition: WeatherCondition;
  conditionDescription: string;
  precipitation?: number;
  uvIndex?: number;
  pressure?: number;
  visibility?: number;
  recordedAt: string;
  isCached?: boolean;
  isStale?: boolean;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  precipitationProbability: number;
  weatherCode: number;
  condition: WeatherCondition;
  windSpeed?: number;
  humidity?: number;
}

export interface DailyForecast {
  date: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationProbability: number;
  precipitationSum?: number;
  weatherCode: number;
  condition: WeatherCondition;
  sunrise?: string;
  sunset?: string;
}

export interface CacheMetadata {
  cachedAt: string;
  isCached: boolean;
  isFresh: boolean;
  isStale: boolean;
  currentExpiresAt: string;
  hourlyExpiresAt: string;
  dailyExpiresAt: string;
  ageSeconds: number;
}

export interface WeatherReport {
  locationId: string;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  lastUpdated: string;
  fetchedAt?: string;
  timezone?: string;
  cacheMetadata?: CacheMetadata;
}

export type WeatherData = WeatherReport;

