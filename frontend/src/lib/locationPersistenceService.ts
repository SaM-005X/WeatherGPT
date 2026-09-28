/**
 * Location Persistence & Geocoding Caching Service Layer
 *
 * Provides high-level abstractions over Supabase tables:
 * - public.locations (persisting selected locations)
 * - public.geocoding_cache (caching place-name search queries)
 *
 * Resilience:
 * - All methods are wrapped in try-catch guards.
 * - Under no circumstances will a database error crash the application or prevent
 *   live weather / geocoding from functioning.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ActiveLocation, GeocodingResult } from '@/types/location';

export interface PersistedLocationRecord {
  id: string;
  name: string;
  country: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
  source: string;
  coord_key: string;
  created_at: string;
  updated_at: string;
}

/**
 * Normalizes a place-name search query for consistent cache keying.
 * Example: "  Moscow , Russia  " -> "moscow, russia"
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Persists an ActiveLocation to Supabase.
 * Uses atomic upsert on coord_key to update the timestamp if already present.
 * Non-blocking: returns true on success, false on error or offline.
 */
export async function persistActiveLocation(location: ActiveLocation): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  try {
    const latRounded = Number(location.latitude.toFixed(4));
    const lonRounded = Number(location.longitude.toFixed(4));

    // Special handling for device location / "Current Location":
    // Prevent duplicate records caused by device GPS coordinate jitter.
    // Check if a device location record already exists in Supabase to update in-place.
    if (location.source === 'device' || location.name === 'Current Location') {
      const { data: existingDevice } = await supabase
        .from('locations')
        .select('id')
        .or('source.eq.device,name.eq.Current Location')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingDevice) {
        const { error: updateError } = await supabase
          .from('locations')
          .update({
            name: 'Current Location',
            country: location.country || null,
            admin1: location.admin1 || location.state || null,
            latitude: latRounded,
            longitude: lonRounded,
            timezone: location.timezone || null,
            source: 'device',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingDevice.id);

        if (!updateError) {
          return true;
        }
      }
    }

    const { error } = await supabase
      .from('locations')
      .upsert(
        {
          name: location.name,
          country: location.country || null,
          admin1: location.admin1 || location.state || null,
          latitude: latRounded,
          longitude: lonRounded,
          timezone: location.timezone || null,
          source: location.source,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'coord_key',
        }
      );

    if (error) {
      console.warn('[LocationPersistence] Unable to persist location to Supabase:', error.message);
      return false;
    }

    return true;
  } catch (err: unknown) {
    console.warn('[LocationPersistence] Unexpected failure persisting location:', err);
    return false;
  }
}

/**
 * Retrieves cached geocoding results for a given search query if present and not expired.
 * Returns null on cache miss, expiration, or database failure.
 */
export async function getCachedGeocoding(
  query: string
): Promise<GeocodingResult[] | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const normalized = normalizeQuery(query);
  if (!normalized || normalized.length < 2) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('geocoding_cache')
      .select('results, expires_at')
      .eq('query', normalized)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.warn('[LocationPersistence] Geocoding cache lookup error:', error.message);
      return null;
    }

    if (data && Array.isArray(data.results)) {
      return data.results as GeocodingResult[];
    }

    return null;
  } catch (err: unknown) {
    console.warn('[LocationPersistence] Unexpected error reading geocoding cache:', err);
    return null;
  }
}

/**
 * Stores geocoding search results in the Supabase cache with a 30-day TTL.
 * Upserts on conflict (query) to renew results or expiration date.
 */
export async function setCachedGeocoding(
  query: string,
  results: GeocodingResult[]
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  const normalized = normalizeQuery(query);
  if (!normalized || results.length === 0) {
    return false;
  }

  try {
    // 30 days expiration window
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('geocoding_cache').upsert(
      {
        query: normalized,
        results: results,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      {
        onConflict: 'query',
      }
    );

    if (error) {
      console.warn('[LocationPersistence] Unable to cache geocoding results:', error.message);
      return false;
    }

    return true;
  } catch (err: unknown) {
    console.warn('[LocationPersistence] Unexpected failure caching geocoding results:', err);
    return false;
  }
}

/**
 * Retrieves the most recently selected/persisted locations from Supabase.
 * Applies deterministic deduplication to guarantee:
 * 1. At most one "Current Location" / device location entry (the most recent).
 * 2. Strict coordinate deduplication (coord_key and proximity within ~0.001 deg / 100m).
 * 3. Most recently updated locations appear first in the returned list.
 * Useful for recent locations list or quick-revisit UI.
 */
export async function getRecentPersistedLocations(
  limit = 5
): Promise<ActiveLocation[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  try {
    // Fetch a wider window to ensure we get up to `limit` distinct locations after deduplication
    const fetchLimit = Math.max(limit * 3, 20);
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(fetchLimit);

    if (error || !data) {
      return [];
    }

    const seenCoordKeys = new Set<string>();
    let seenCurrentLocation = false;
    const deduplicated: ActiveLocation[] = [];

    for (const row of data as PersistedLocationRecord[]) {
      const isDevice = row.source === 'device' || row.name === 'Current Location';

      // 1. Guarantee at most one "Current Location" record (the most recently updated)
      if (isDevice) {
        if (seenCurrentLocation) {
          continue;
        }
        seenCurrentLocation = true;
      }

      // 2. Guarantee coordinate uniqueness (exact coord_key or ~0.001 deg proximity)
      const coordKey = row.coord_key || `${row.latitude.toFixed(4)},${row.longitude.toFixed(4)}`;
      if (seenCoordKeys.has(coordKey)) {
        continue;
      }

      // Proximity check (within ~0.001 deg, ~100m) to catch any slight coordinate drift
      const isNearbyDuplicate = deduplicated.some(
        (existing) =>
          Math.abs(existing.latitude - row.latitude) < 0.001 &&
          Math.abs(existing.longitude - row.longitude) < 0.001
      );
      if (isNearbyDuplicate) {
        continue;
      }

      seenCoordKeys.add(coordKey);

      deduplicated.push({
        id: `loc-persisted-${row.id}`,
        name: row.name,
        country: row.country || undefined,
        state: row.admin1 || undefined,
        admin1: row.admin1 || undefined,
        latitude: row.latitude,
        longitude: row.longitude,
        timezone: row.timezone || undefined,
        source: (row.source === 'device' ? 'device' : 'manual') as 'device' | 'manual',
        timestamp: row.updated_at || row.created_at,
      });

      if (deduplicated.length >= limit) {
        break;
      }
    }

    return deduplicated;
  } catch {
    return [];
  }
}
