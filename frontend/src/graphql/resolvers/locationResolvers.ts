/**
 * Location GraphQL Resolvers
 *
 * Exposes location search and saved location queries by delegating directly to
 * geocodingService.ts and locationPersistenceService.ts.
 */

import { GraphQLError } from 'graphql';
import { searchGeocodingLocations } from '@/lib/geocodingService';
import { getRecentPersistedLocations } from '@/lib/locationPersistenceService';

export interface GraphQLLocation {
  id: string;
  name: string;
  country?: string | null;
  admin1?: string | null;
  latitude: number;
  longitude: number;
  timezone?: string | null;
  source?: string | null;
}

export const locationResolvers = {
  Query: {
    searchLocations: async (
      _parent: unknown,
      args: { query: string; limit?: number }
    ): Promise<GraphQLLocation[]> => {
      const query = args.query?.trim();

      if (!query) {
        throw new GraphQLError('Search query cannot be empty.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      try {
        const results = await searchGeocodingLocations(query);
        const limit = args.limit && args.limit > 0 ? args.limit : 5;
        const sliced = results.slice(0, limit);

        return sliced.map((res) => ({
          id: String(res.id),
          name: res.name,
          country: res.country ?? null,
          admin1: res.admin1 ?? null,
          latitude: res.latitude,
          longitude: res.longitude,
          timezone: res.timezone ?? null,
          source: 'search',
        }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Location search failed.';
        throw new GraphQLError(message, {
          extensions: { code: 'LOCATION_SERVICE_ERROR' },
        });
      }
    },

    savedLocations: async (
      _parent: unknown,
      args: { limit?: number }
    ): Promise<GraphQLLocation[]> => {
      try {
        const limit = args.limit && args.limit > 0 ? args.limit : 5;
        const persisted = await getRecentPersistedLocations(limit);

        return persisted.map((loc) => ({
          id: loc.id,
          name: loc.name,
          country: loc.country ?? null,
          admin1: loc.admin1 ?? loc.state ?? null,
          latitude: loc.latitude,
          longitude: loc.longitude,
          timezone: loc.timezone ?? null,
          source: loc.source,
        }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to retrieve saved locations.';
        throw new GraphQLError(message, {
          extensions: { code: 'LOCATION_PERSISTENCE_ERROR' },
        });
      }
    },
  },
};
