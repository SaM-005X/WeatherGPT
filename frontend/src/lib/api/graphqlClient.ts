/**
 * AWS AppSync / GraphQL Client Module
 *
 * Lightweight GraphQL client utilizing native Web fetch to execute
 * typed operations against the provisioned AWS AppSync HTTPS endpoint
 * (or fallback GraphQL endpoint).
 */

import {
  WeatherReport,
  HourlyForecast,
  DailyForecast,
  WeatherCondition,
} from '@/types/weather';
import { fetchWeatherData } from '@/lib/weatherService';

export interface GraphQLCoordinatesInput {
  latitude: number;
  longitude: number;
}

export interface GraphQLCurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  condition: WeatherCondition;
  conditionDescription: string;
  precipitation?: number | null;
  uvIndex?: number | null;
  pressure?: number | null;
  visibility?: number | null;
  cloudCover?: number | null;
  recordedAt: string;
  isCached?: boolean | null;
}

export interface GraphQLHourlyForecast {
  time: string;
  temperature: number;
  precipitationProbability: number;
  weatherCode: number;
  condition: WeatherCondition;
  windSpeed?: number | null;
  humidity?: number | null;
}

export interface GraphQLDailyForecast {
  date: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationProbability: number;
  precipitationSum?: number | null;
  weatherCode: number;
  condition: WeatherCondition;
  sunrise?: string | null;
  sunset?: string | null;
}

export interface GraphQLWeatherReport {
  locationId: string;
  current: GraphQLCurrentWeather;
  hourly: GraphQLHourlyForecast[];
  daily: GraphQLDailyForecast[];
  lastUpdated: string;
  timezone?: string | null;
}

export interface WeatherByCoordinatesResponse {
  weatherByCoordinates: GraphQLWeatherReport;
}

export interface RefreshWeatherResponse {
  refreshWeather: GraphQLWeatherReport;
}

export interface GraphQLErrorLocation {
  line: number;
  column: number;
}

export interface GraphQLErrorItem {
  message: string;
  locations?: GraphQLErrorLocation[];
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponseBody<TData> {
  data?: TData;
  errors?: GraphQLErrorItem[];
}

export class GraphQLClientError extends Error {
  public errors?: GraphQLErrorItem[];
  public statusCode?: number;

  constructor(message: string, errors?: GraphQLErrorItem[], statusCode?: number) {
    super(message);
    this.name = 'GraphQLClientError';
    this.errors = errors;
    this.statusCode = statusCode;
  }
}

export interface FetchWeatherOptions {
  signal?: AbortSignal;
  forceRefresh?: boolean;
  fallbackToDirect?: boolean;
}

export const WEATHER_BY_COORDINATES_QUERY = /* GraphQL */ `
  query WeatherByCoordinates($coordinates: CoordinatesInput!) {
    weatherByCoordinates(coordinates: $coordinates) {
      locationId
      lastUpdated
      timezone
      current {
        temperature
        feelsLike
        humidity
        windSpeed
        windDirection
        weatherCode
        condition
        conditionDescription
        precipitation
        uvIndex
        pressure
        visibility
        cloudCover
        recordedAt
        isCached
      }
      hourly {
        time
        temperature
        precipitationProbability
        weatherCode
        condition
        windSpeed
        humidity
      }
      daily {
        date
        temperatureMin
        temperatureMax
        precipitationProbability
        precipitationSum
        weatherCode
        condition
        sunrise
        sunset
      }
    }
  }
`;

export const REFRESH_WEATHER_MUTATION = /* GraphQL */ `
  mutation RefreshWeather($coordinates: CoordinatesInput!) {
    refreshWeather(coordinates: $coordinates) {
      locationId
      lastUpdated
      timezone
      current {
        temperature
        feelsLike
        humidity
        windSpeed
        windDirection
        weatherCode
        condition
        conditionDescription
        precipitation
        uvIndex
        pressure
        visibility
        cloudCover
        recordedAt
        isCached
      }
      hourly {
        time
        temperature
        precipitationProbability
        weatherCode
        condition
        windSpeed
        humidity
      }
      daily {
        date
        temperatureMin
        temperatureMax
        precipitationProbability
        precipitationSum
        weatherCode
        condition
        sunrise
        sunset
      }
    }
  }
`;

/**
 * Resolves the active GraphQL endpoint URL.
 * Prioritizes AppSync environment variables with fallback to local proxy.
 */
export function getAppSyncEndpoint(): string {
  if (process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL) {
    return process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL;
  }
  if (process.env.NEXT_PUBLIC_APPSYNC_ENDPOINT) {
    return process.env.NEXT_PUBLIC_APPSYNC_ENDPOINT;
  }
  if (process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT) {
    return process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
  }
  if (typeof window !== 'undefined') {
    return '/api/graphql';
  }
  return 'http://localhost:3000/api/graphql';
}

/**
 * Resolves the public AppSync API key if configured.
 */
export function getAppSyncApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_APPSYNC_API_KEY || undefined;
}

/**
 * Normalizes GraphQL response to client WeatherReport model.
 */
function normalizeWeatherReport(report: GraphQLWeatherReport): WeatherReport {
  return {
    locationId: report.locationId,
    lastUpdated: report.lastUpdated,
    timezone: report.timezone || 'UTC',
    current: {
      temperature: report.current.temperature,
      feelsLike: report.current.feelsLike,
      humidity: report.current.humidity,
      windSpeed: report.current.windSpeed,
      windDirection: report.current.windDirection,
      weatherCode: report.current.weatherCode,
      condition: report.current.condition,
      conditionDescription: report.current.conditionDescription,
      precipitation: report.current.precipitation ?? undefined,
      uvIndex: report.current.uvIndex ?? undefined,
      pressure: report.current.pressure ?? undefined,
      visibility: report.current.visibility ?? undefined,
      cloudCover: report.current.cloudCover ?? undefined,
      recordedAt: report.current.recordedAt,
      isCached: report.current.isCached ?? undefined,
    },
    hourly: report.hourly.map((h): HourlyForecast => ({
      time: h.time,
      temperature: h.temperature,
      precipitationProbability: h.precipitationProbability,
      weatherCode: h.weatherCode,
      condition: h.condition,
      windSpeed: h.windSpeed ?? undefined,
      humidity: h.humidity ?? undefined,
    })),
    daily: report.daily.map((d): DailyForecast => ({
      date: d.date,
      temperatureMin: d.temperatureMin,
      temperatureMax: d.temperatureMax,
      precipitationProbability: d.precipitationProbability,
      precipitationSum: d.precipitationSum ?? undefined,
      weatherCode: d.weatherCode,
      condition: d.condition,
      sunrise: d.sunrise ?? undefined,
      sunset: d.sunset ?? undefined,
    })),
  };
}

export const inFlightRequests = new Map<string, Promise<WeatherReport>>();

/**
 * Returns count of currently active in-flight GraphQL network requests.
 */
export function getGraphQLInFlightCount(): number {
  return inFlightRequests.size;
}

/**
 * Clears active in-flight GraphQL requests (useful for tests).
 */
export function clearGraphQLInFlightRequests(): void {
  inFlightRequests.clear();
}

/**
 * Helper to attach an AbortSignal to a promise without cancelling the underlying work
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
 * Fetches weather data for given coordinates by executing a GraphQL query/mutation
 * against the live AppSync backend via standard native fetch.
 *
 * Includes fast-fail on overload / timeout (2500ms) and graceful fallback
 * to direct domain service if the cloud endpoint encounters errors.
 * Coordinate request deduplication ensures multiple callers share a single in-flight promise.
 */
export async function fetchWeatherByCoordinates(
  latitude: number,
  longitude: number,
  options?: FetchWeatherOptions
): Promise<WeatherReport> {
  const dedupKey = `${latitude.toFixed(3)}_${longitude.toFixed(3)}`;

  // Re-use active in-flight request if already pending for these coordinates
  if (inFlightRequests.has(dedupKey) && !options?.forceRefresh) {
    const activePromise = inFlightRequests.get(dedupKey)!;
    return await attachAbortSignal(activePromise, options?.signal);
  }

  const executeRequest = (async (): Promise<WeatherReport> => {
    const endpoint = getAppSyncEndpoint();
    const apiKey = getAppSyncApiKey();

    const query = WEATHER_BY_COORDINATES_QUERY;
    const operationName = 'WeatherByCoordinates';
    const variables = {
      coordinates: {
        latitude,
        longitude,
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    // 4500ms timeout controller for AppSync fast-fail
    const timeoutController = new AbortController();
    const timeoutTimer = setTimeout(() => {
      timeoutController.abort(new Error('AppSync timeout after 4500ms'));
    }, 4500);

    // Merge options.signal with internal timeoutController
    let removeCallerAbortListener: (() => void) | undefined;
    if (options?.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutTimer);
        if (options.fallbackToDirect === false) {
          throw new DOMException('The user aborted a request.', 'AbortError');
        }
        // If fallback is enabled, switch silently to direct service fallback
        console.warn('[GraphQLClient] Caller signal already aborted, executing direct fallback.');
        return await fetchWeatherData(latitude, longitude, {
          forceRefresh: options.forceRefresh,
        });
      }
      const onCallerAbort = () => {
        timeoutController.abort(new DOMException('The user aborted a request.', 'AbortError'));
      };
      options.signal.addEventListener('abort', onCallerAbort, { once: true });
      removeCallerAbortListener = () => {
        options.signal?.removeEventListener('abort', onCallerAbort);
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          variables,
          operationName,
        }),
        signal: timeoutController.signal,
      });

      clearTimeout(timeoutTimer);
      if (removeCallerAbortListener) removeCallerAbortListener();

      if (!response.ok) {
        throw new GraphQLClientError(
          `AppSync HTTP Error: ${response.status} ${response.statusText}`,
          undefined,
          response.status
        );
      }

      const json = (await response.json()) as GraphQLResponseBody<WeatherByCoordinatesResponse>;

      if (json.errors && json.errors.length > 0) {
        const errorMsg = json.errors.map((e) => e.message).join('; ');
        throw new GraphQLClientError(`AppSync GraphQL Error: ${errorMsg}`, json.errors);
      }

      if (!json.data || !json.data.weatherByCoordinates) {
        throw new GraphQLClientError('AppSync GraphQL response returned empty weather data.');
      }

      return normalizeWeatherReport(json.data.weatherByCoordinates);
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      if (removeCallerAbortListener) removeCallerAbortListener();

      // Graceful fallback to direct weatherService if enabled (default true)
      if (options?.fallbackToDirect !== false) {
        try {
          console.warn(
            `[GraphQLClient] AppSync request failed or timed out (${
              err instanceof Error ? err.message : String(err)
            }), executing direct fallback.`
          );
          return await fetchWeatherData(latitude, longitude, {
            forceRefresh: options?.forceRefresh,
          });
        } catch (fallbackErr: unknown) {
          console.warn('[GraphQLClient] Direct fallback also failed:', fallbackErr);
        }
      }

      // If user/caller explicitly cancelled the request and fallback was disabled
      if (options?.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }

      if (err instanceof GraphQLClientError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Unknown network failure';
      throw new GraphQLClientError(`AppSync request failed: ${message}`);
    } finally {
      inFlightRequests.delete(dedupKey);
    }

  })();

  inFlightRequests.set(dedupKey, executeRequest);
  return await attachAbortSignal(executeRequest, options?.signal);
}

