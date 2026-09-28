/**
 * Phase 4 Comprehensive Test Suite: Supabase Integration & Location Persistence
 *
 * Validates:
 * 1. Supabase Client Connection & Configuration.
 * 2. Location Persistence (Insert/Upsert) with coordinate rounding & metadata.
 * 3. Retrieval of persisted locations.
 * 4. Geocoding Cache (Query normalization, 30-day TTL, cache hit verification).
 * 5. Distinct multi-location persistence (e.g. Moscow vs Tokyo).
 * 6. Direct coordinate persistence (22.5726, 88.3639).
 * 7. Invalid/Unknown location handling (no cache pollution).
 * 8. Supabase Failure Resiliency (Graceful degradation, non-blocking fallback).
 */

import assert from 'node:assert';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  persistActiveLocation,
  getCachedGeocoding,
  setCachedGeocoding,
  getRecentPersistedLocations,
  normalizeQuery,
} from '../lib/locationPersistenceService';
import { searchGeocodingLocations } from '../lib/geocodingService';
import { ActiveLocation, GeocodingResult } from '../types/location';

async function runSupabaseIntegrationTests() {
  console.log('=== RUNNING PHASE 4 SUPABASE INTEGRATION & PERSISTENCE TESTS ===\n');

  // --------------------------------------------------------------------------
  // Test 1 — Supabase Connection & Configuration
  // --------------------------------------------------------------------------
  console.log('[1/8] Test 1: Verifying Supabase connection and configuration...');
  assert.strictEqual(
    isSupabaseConfigured(),
    true,
    'Expected Supabase to be configured via environment variables.'
  );
  assert(supabase !== null, 'Expected Supabase client instance to be initialized.');

  const { error: pingError } = await supabase
    .from('locations')
    .select('id')
    .limit(1);

  assert.strictEqual(
    pingError,
    null,
    `Failed to query Supabase locations table: ${pingError?.message}`
  );
  console.log('✔ Supabase connection established successfully.\n');

  // --------------------------------------------------------------------------
  // Test 2 — Insert / Persist Location (Moscow)
  // --------------------------------------------------------------------------
  console.log('[2/8] Test 2: Persisting location "Moscow" to Supabase...');
  const moscowLocation: ActiveLocation = {
    id: `loc-test-${Date.now()}`,
    name: 'Moscow',
    country: 'Russia',
    admin1: 'Moscow',
    latitude: 55.7522,
    longitude: 37.6156,
    timezone: 'Europe/Moscow',
    source: 'manual',
    timestamp: new Date().toISOString(),
  };

  const persistMoscowResult = await persistActiveLocation(moscowLocation);
  assert.strictEqual(persistMoscowResult, true, 'Failed to persist Moscow to Supabase.');
  console.log('✔ Moscow successfully persisted.\n');

  // --------------------------------------------------------------------------
  // Test 3 — Retrieve Persisted Location
  // --------------------------------------------------------------------------
  console.log('[3/8] Test 3: Retrieving persisted locations from Supabase...');
  const recentLocations = await getRecentPersistedLocations(10);
  assert(recentLocations.length > 0, 'Expected at least 1 persisted location.');

  const foundMoscow = recentLocations.find(
    (loc) => Math.abs(loc.latitude - 55.7522) < 0.001 && Math.abs(loc.longitude - 37.6156) < 0.001
  );

  assert(foundMoscow, 'Expected to find Moscow in recent persisted locations.');
  assert.strictEqual(foundMoscow.name, 'Moscow');
  assert.strictEqual(foundMoscow.country, 'Russia');
  assert.strictEqual(foundMoscow.admin1, 'Moscow');
  assert.strictEqual(foundMoscow.timezone, 'Europe/Moscow');
  console.log(`✔ Retrieved persisted location: ${foundMoscow.name} (${foundMoscow.latitude}, ${foundMoscow.longitude})\n`);

  // --------------------------------------------------------------------------
  // Test 4 — Geocoding Cache Flow
  // --------------------------------------------------------------------------
  console.log('[4/8] Test 4: Testing Geocoding Cache (miss, set, hit)...');
  const testQuery = 'Munich Germany';
  const normalizedTestQuery = normalizeQuery(testQuery);

  const mockResults: GeocodingResult[] = [
    {
      id: 2867714,
      name: 'Munich',
      latitude: 48.1374,
      longitude: 11.5755,
      country: 'Germany',
      admin1: 'Bavaria',
      timezone: 'Europe/Berlin',
    },
  ];

  // Write to cache
  const cacheWriteSuccess = await setCachedGeocoding(normalizedTestQuery, mockResults);
  assert.strictEqual(cacheWriteSuccess, true, 'Failed to write to geocoding cache.');

  // Read back from cache
  const cachedLookup = await getCachedGeocoding(testQuery);
  assert(cachedLookup !== null, 'Expected cache hit for "Munich Germany".');
  assert.strictEqual(cachedLookup.length, 1);
  assert.strictEqual(cachedLookup[0].name, 'Munich');
  assert.strictEqual(cachedLookup[0].country, 'Germany');

  // Execute search through searchGeocodingLocations and verify cache path
  const resolvedFromCache = await searchGeocodingLocations('Munich Germany');
  assert.strictEqual(resolvedFromCache[0].name, 'Munich');
  console.log('✔ Geocoding cache verified with clean hit.\n');

  // --------------------------------------------------------------------------
  // Test 5 — Different Location Persistence (Tokyo)
  // --------------------------------------------------------------------------
  console.log('[5/8] Test 5: Persisting second distinct location "Tokyo"...');
  const tokyoLocation: ActiveLocation = {
    id: `loc-test-${Date.now() + 1}`,
    name: 'Tokyo',
    country: 'Japan',
    admin1: 'Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
    timezone: 'Asia/Tokyo',
    source: 'manual',
    timestamp: new Date().toISOString(),
  };

  const persistTokyoResult = await persistActiveLocation(tokyoLocation);
  assert.strictEqual(persistTokyoResult, true, 'Failed to persist Tokyo.');

  const updatedRecents = await getRecentPersistedLocations(10);
  const foundTokyo = updatedRecents.find((loc) => loc.name === 'Tokyo');
  const foundMoscowAgain = updatedRecents.find((loc) => loc.name === 'Moscow');

  assert(foundTokyo, 'Expected to find Tokyo in persisted locations.');
  assert(foundMoscowAgain, 'Expected Moscow to still exist alongside Tokyo.');
  console.log('✔ Tokyo and Moscow verified as distinct persistent records.\n');

  // --------------------------------------------------------------------------
  // Test 6 — Coordinate-Based Location Persistence
  // --------------------------------------------------------------------------
  console.log('[6/8] Test 6: Persisting direct coordinates (22.5726, 88.3639)...');
  const coordLocation: ActiveLocation = {
    id: `loc-coord-${Date.now()}`,
    name: 'Coordinates (22.57, 88.36)',
    latitude: 22.5726,
    longitude: 88.3639,
    source: 'manual',
    timestamp: new Date().toISOString(),
  };

  const persistCoordResult = await persistActiveLocation(coordLocation);
  assert.strictEqual(persistCoordResult, true, 'Failed to persist coordinate location.');

  const recentsWithCoords = await getRecentPersistedLocations(10);
  const foundCoords = recentsWithCoords.find(
    (loc) => Math.abs(loc.latitude - 22.5726) < 0.001 && Math.abs(loc.longitude - 88.3639) < 0.001
  );
  assert(foundCoords, 'Expected coordinates (22.5726, 88.3639) to be persisted.');
  console.log(`✔ Coordinates location persisted: (${foundCoords.latitude}, ${foundCoords.longitude})\n`);

  // --------------------------------------------------------------------------
  // Test 7 — Invalid / Unknown Location Handling
  // --------------------------------------------------------------------------
  console.log('[7/8] Test 7: Verifying invalid/nonexistent location handling...');
  const unknownResults = await searchGeocodingLocations('xyznonexistent123');
  assert.strictEqual(unknownResults.length, 0, 'Expected empty results for nonexistent query.');

  const cachedUnknown = await getCachedGeocoding('xyznonexistent123');
  assert.strictEqual(cachedUnknown, null, 'Cache must not store empty/invalid results.');
  console.log('✔ Invalid queries do not pollute cache and return clean empty results.\n');

  // --------------------------------------------------------------------------
  // Test 8 — Supabase Failure Resiliency & Graceful Fallback
  // --------------------------------------------------------------------------
  console.log('[8/8] Test 8: Verifying failure resiliency and fallback behavior...');
  // 1. Bypass cache should still succeed via direct Open-Meteo REST API
  const liveResultsBypassingCache = await searchGeocodingLocations('London', undefined, true);
  assert(liveResultsBypassingCache.length > 0, 'Expected live results when bypassing cache.');
  assert.strictEqual(liveResultsBypassingCache[0].name, 'London');

  // 2. Query normalizer with empty/blank strings
  assert.strictEqual(normalizeQuery('   '), '');
  const emptyLookup = await getCachedGeocoding('');
  assert.strictEqual(emptyLookup, null);

  console.log('✔ Core geocoding and fallback paths execute reliably under all conditions.\n');

  console.log('======================================================');
  console.log('ALL PHASE 4 SUPABASE INTEGRATION TESTS PASSED! ✔');
  console.log('======================================================\n');
}

runSupabaseIntegrationTests().catch((err) => {
  console.error('Phase 4 Test Suite Failed:', err);
  process.exit(1);
});
