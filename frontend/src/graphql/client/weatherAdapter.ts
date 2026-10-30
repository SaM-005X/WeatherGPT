/**
 * Weather GraphQL Adapter
 *
 * Provides a drop-in adapter matching the exact call signature of fetchWeatherData,
 * but executes the request through typed GraphQL queries and mutations.
 * Returns the exact normalized WeatherReport model in Celsius.
 */

import { executeGraphQL } from './graphqlClient';
import { GET_WEATHER_BY_COORDINATES, REFRESH_WEATHER_MUTATION } from './operations';
import { WeatherReport } from '@/types/weather';
import { WeatherFetchOptions, fetchWeatherData } from '@/lib/weatherService';

/**
 * Fetches weather data by delegating to the GraphQL Gateway.
 * If options.forceRefresh is true, dispatches Mutation.refreshWeather;
 * otherwise dispatches Query.weatherByCoordinates.
 * Includes graceful fast fallback to direct weatherService on network/auth errors.
 */
export async function fetchWeatherViaGraphQL(
  latitude: number,
  longitude: number,
  options?: WeatherFetchOptions
): Promise<WeatherReport> {
  const coordinates = { latitude, longitude };

  try {
    if (options?.forceRefresh) {
      const data = await executeGraphQL<{ refreshWeather: WeatherReport }>(
        REFRESH_WEATHER_MUTATION,
        { coordinates },
        { signal: options?.signal }
      );
      return data.refreshWeather;
    }

    const data = await executeGraphQL<{ weatherByCoordinates: WeatherReport }>(
      GET_WEATHER_BY_COORDINATES,
      { coordinates },
      { signal: options?.signal }
    );
    return data.weatherByCoordinates;
  } catch {
    // Fast failover to direct domain service when GraphQL endpoint is unreachable or unauthorized
    return await fetchWeatherData(latitude, longitude, options);
  }
}

export { fetchWeatherByCoordinates } from '@/lib/api/graphqlClient';

