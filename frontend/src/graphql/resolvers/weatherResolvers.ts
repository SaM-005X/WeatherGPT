/**
 * Weather GraphQL Resolvers
 *
 * Exposes weather operations via GraphQL by delegating directly to weatherService.ts.
 * Provider-specific logic and normalization remain encapsulated in the domain service.
 * All temperature outputs are in Celsius.
 */

import { GraphQLError } from 'graphql';
import { fetchWeatherData, validateCoordinates } from '@/lib/weatherService';
import { WeatherReport } from '@/types/weather';

export interface CoordinatesInput {
  latitude: number;
  longitude: number;
}

export const weatherResolvers = {
  Query: {
    weatherByCoordinates: async (
      _parent: unknown,
      args: { coordinates: CoordinatesInput }
    ): Promise<WeatherReport> => {
      const { coordinates } = args;

      if (!coordinates) {
        throw new GraphQLError('Coordinates are required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      try {
        validateCoordinates(coordinates.latitude, coordinates.longitude);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid coordinates provided.';
        throw new GraphQLError(message, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      try {
        return await fetchWeatherData(coordinates.latitude, coordinates.longitude, {
          forceRefresh: false,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Weather provider failure.';
        throw new GraphQLError(message, {
          extensions: { code: 'WEATHER_PROVIDER_ERROR' },
        });
      }
    },
  },

  Mutation: {
    refreshWeather: async (
      _parent: unknown,
      args: { coordinates: CoordinatesInput }
    ): Promise<WeatherReport> => {
      const { coordinates } = args;

      if (!coordinates) {
        throw new GraphQLError('Coordinates are required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      try {
        validateCoordinates(coordinates.latitude, coordinates.longitude);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid coordinates provided.';
        throw new GraphQLError(message, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      try {
        return await fetchWeatherData(coordinates.latitude, coordinates.longitude, {
          forceRefresh: true,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Weather refresh failed.';
        throw new GraphQLError(message, {
          extensions: { code: 'WEATHER_PROVIDER_ERROR' },
        });
      }
    },

    askWeatherAssistant: async (
      _parent: unknown,
      args: { message: string; coordinates?: CoordinatesInput }
    ): Promise<{ reply: string; isOffTopic: boolean }> => {
      const message = args.message?.trim();
      if (!message) {
        throw new GraphQLError('Message text cannot be empty.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Architectural preparation stub (preserves contract without introducing a competing chatbot)
      return {
        reply: '[Preview] Weather Assistant API contract is ready. Dedicated AI backend connects in Phase 9.',
        isOffTopic: false,
      };
    },
  },
};
