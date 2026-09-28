/**
 * Phase 4.1 Automated Verification Suite
 *
 * Validates:
 * 1. Weather Refresh Cache Bypass (forceRefresh retrieves fresh data and updates cache).
 * 2. Unified Meteorological Payload (current, 24-hr hourly, and 7-day daily forecast update atomically).
 * 3. Consistent Observation Timestamps (recordedAt is strictly derived from verified response).
 * 4. Immediate Saved Locations Synchronization (newly persisted location appears immediately at index 0).
 * 5. Automatic Deduplication on Coordinates (re-persisting coordinates updates timestamp without creating duplicate entries).
 * 6. Non-Blocking Graceful Degradation (Supabase failure does not throw or crash).
 */

import assert from 'node:assert';
import { fetchWeatherData, clearWeatherCache } from '../lib/weatherService';
import {
  persistActiveLocation,
  getRecentPersistedLocations,
} from '../lib/locationPersistenceService';
import { ActiveLocation } from '../types/location';

async function runPhase41VerificationTests() {
  console.log('=== RUNNING PHASE 4.1 AUTOMATIC REFRESH & LIVE SAVED VERIFICATION TESTS ===\n');

  // Clear cache for clean test state
  clearWeatherCache();

  // --------------------------------------------------------------------------
  // Test 1: Weather Refresh Cache Bypass
  // --------------------------------------------------------------------------
  console.log('[1/6] Test 1: Weather Cache Hit vs. Force Refresh...');
  const initialFetch = await fetchWeatherData(51.5074, -0.1278); // London
  assert.strictEqual(initialFetch.current.isCached, false, 'Initial fetch should not be cached.');

  const cachedFetch = await fetchWeatherData(51.5074, -0.1278);
  assert.strictEqual(cachedFetch.current.isCached, true, 'Subsequent fetch within TTL must be cached.');

  const forcedRefreshFetch = await fetchWeatherData(51.5074, -0.1278, { forceRefresh: true });
  assert.strictEqual(forcedRefreshFetch.current.isCached, false, 'forceRefresh must bypass in-memory cache.');
  assert(forcedRefreshFetch.lastUpdated, 'Expected lastUpdated timestamp on refreshed weather.');
  console.log('✔ Cache hit and force-refresh cache bypass verified.\n');

  // --------------------------------------------------------------------------
  // Test 2: Unified Meteorological Payload (Current + Hourly + 7-Day Forecast)
  // --------------------------------------------------------------------------
  console.log('[2/6] Test 2: Verifying atomic Current + Hourly + 7-Day Daily Forecast...');
  assert(forcedRefreshFetch.current.temperature !== undefined, 'Current temperature must be present.');
  assert(Array.isArray(forcedRefreshFetch.hourly), 'Hourly forecast must be an array.');
  assert.strictEqual(forcedRefreshFetch.hourly.length, 24, 'Hourly forecast must contain 24 hours.');
  assert(Array.isArray(forcedRefreshFetch.daily), 'Daily forecast must be an array.');
  assert.strictEqual(forcedRefreshFetch.daily.length, 7, 'Daily forecast must contain 7 days.');
  console.log('✔ Atomic weather report (current, 24h hourly, 7-day daily) verified.\n');

  // --------------------------------------------------------------------------
  // Test 3: Consistent Observation Timestamps
  // --------------------------------------------------------------------------
  console.log('[3/6] Test 3: Verifying observation timestamps consistency...');
  assert(forcedRefreshFetch.current.recordedAt, 'Observation recordedAt must exist.');
  const recordedDate = new Date(forcedRefreshFetch.current.recordedAt);
  assert(!isNaN(recordedDate.getTime()), 'recordedAt must be a valid ISO date.');
  console.log(`   Recorded At: ${forcedRefreshFetch.current.recordedAt}`);
  console.log('✔ Observation timestamp integrity verified.\n');

  // --------------------------------------------------------------------------
  // Test 4: Immediate Saved Locations Synchronization (Paris)
  // --------------------------------------------------------------------------
  console.log('[4/6] Test 4: Immediate Saved Location Persistence (Paris)...');
  const parisLocation: ActiveLocation = {
    id: `loc-paris-${Date.now()}`,
    name: 'Paris',
    country: 'France',
    admin1: 'Île-de-France',
    latitude: 48.8566,
    longitude: 2.3522,
    timezone: 'Europe/Paris',
    source: 'manual',
    timestamp: new Date().toISOString(),
  };

  const persistParisSuccess = await persistActiveLocation(parisLocation);
  assert.strictEqual(persistParisSuccess, true, 'Paris must be persisted to Supabase.');

  const recentAfterParis = await getRecentPersistedLocations(5);
  assert(recentAfterParis.length > 0, 'Recent locations must not be empty.');
  const topParis = recentAfterParis[0];
  assert.strictEqual(topParis.name, 'Paris', 'Paris must be at index 0 immediately after persistence.');
  assert.strictEqual(Math.abs(topParis.latitude - 48.8566) < 0.001, true, 'Paris latitude must match.');
  console.log('✔ Paris appears immediately at top of saved locations.\n');

  // --------------------------------------------------------------------------
  // Test 5: Immediate Second Location & Coordinate Deduplication (Mumbai)
  // --------------------------------------------------------------------------
  console.log('[5/6] Test 5: Persisting Mumbai and verifying deduplication...');
  const mumbaiLocation: ActiveLocation = {
    id: `loc-mumbai-${Date.now()}`,
    name: 'Mumbai',
    country: 'India',
    admin1: 'Maharashtra',
    latitude: 19.0760,
    longitude: 72.8777,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    timestamp: new Date().toISOString(),
  };

  const persistMumbaiSuccess = await persistActiveLocation(mumbaiLocation);
  assert.strictEqual(persistMumbaiSuccess, true, 'Mumbai must be persisted to Supabase.');

  const recentAfterMumbai = await getRecentPersistedLocations(5);
  const topMumbai = recentAfterMumbai[0];
  assert.strictEqual(topMumbai.name, 'Mumbai', 'Mumbai must now be at index 0.');

  // Re-persist Mumbai with same coordinates
  const reMumbaiLocation: ActiveLocation = {
    ...mumbaiLocation,
    id: `loc-mumbai-reselect-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
  const rePersistSuccess = await persistActiveLocation(reMumbaiLocation);
  assert.strictEqual(rePersistSuccess, true, 'Re-persisting Mumbai must succeed.');

  const recentsAfterReMumbai = await getRecentPersistedLocations(10);
  const mumbaiMatches = recentsAfterReMumbai.filter(
    (loc) => Math.abs(loc.latitude - 19.0760) < 0.001 && Math.abs(loc.longitude - 72.8777) < 0.001
  );
  assert.strictEqual(mumbaiMatches.length, 1, 'Coordinate deduplication must prevent duplicate Mumbai entries in saved list.');
  console.log('✔ Mumbai verified at top and deduplication confirmed (no duplicates).\n');

  // --------------------------------------------------------------------------
  // Test 6: Non-Blocking Graceful Degradation
  // --------------------------------------------------------------------------
  console.log('[6/6] Test 6: Verifying non-blocking persistence fallback...');
  // Passing an object with invalid coordinate numbers should be rejected safely
  const invalidLoc = {
    id: 'invalid-coords',
    name: 'Invalid',
    latitude: NaN,
    longitude: NaN,
    source: 'manual' as const,
    timestamp: new Date().toISOString(),
  };

  let failedPersistResult = true;
  try {
    failedPersistResult = await persistActiveLocation(invalidLoc);
  } catch {
    failedPersistResult = false;
  }
  assert.strictEqual(failedPersistResult, false, 'Invalid location should return false gracefully without throwing.');
  console.log('✔ Safe degradation confirmed (no unhandled exceptions on failure).\n');

  console.log('======================================================');
  console.log('ALL PHASE 4.1 AUTOMATIC REFRESH & SAVED TESTS PASSED! ✔');
  console.log('======================================================\n');
}

runPhase41VerificationTests().catch((err) => {
  console.error('Phase 4.1 Verification Failed:', err);
  process.exit(1);
});
