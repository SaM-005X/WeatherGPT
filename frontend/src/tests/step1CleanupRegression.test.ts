/**
 * Step 1 Cleanup Regression Test Suite:
 * 1. Global Units State & Conversion Consistency.
 * 2. Duplicate Saved Location Prevention (Device GPS jitter deduplication & coordinate uniqueness).
 * 3. Authoritative Single Unit Toggle Architecture.
 */

import assert from 'node:assert';
import {
  convertTemperature,
  formatTemperature,
  getTemperatureSymbol,
  formatWindSpeed,
} from '../lib/temperature';
import {
  persistActiveLocation,
  getRecentPersistedLocations,
} from '../lib/locationPersistenceService';
import { ActiveLocation } from '../types/location';

async function runStep1CleanupRegressionTests() {
  console.log('=== RUNNING STEP 1 CLEANUP REGRESSION TESTS ===\n');

  // --------------------------------------------------------------------------
  // Test 1: Global Units State & Reversible Conversions
  // --------------------------------------------------------------------------
  console.log('[1/3] Test 1: Verifying Global Units State & Mathematical Reversibility...');
  const baseTempC = 21.5;
  const convertedTempF = convertTemperature(baseTempC, 'imperial');
  assert.strictEqual(
    convertedTempF,
    70.7,
    `Expected 21.5°C to convert to 70.7°F, got ${convertedTempF}`
  );

  const formattedF = formatTemperature(baseTempC, 'imperial');
  assert.strictEqual(formattedF, '70.7');

  const restoredC = formatTemperature(baseTempC, 'metric');
  assert.strictEqual(restoredC, '21.5');

  assert.strictEqual(getTemperatureSymbol('metric'), '°C');
  assert.strictEqual(getTemperatureSymbol('imperial'), '°F');

  const windKm = formatWindSpeed(25, 'metric');
  const windMph = formatWindSpeed(25, 'imperial');
  assert.strictEqual(windKm, '25 km/h');
  assert.strictEqual(windMph, '16 mph');
  console.log('✔ Global units conversion and symbols verified.\n');

  // --------------------------------------------------------------------------
  // Test 2: Device Location GPS Jitter Deduplication
  // --------------------------------------------------------------------------
  console.log('[2/3] Test 2: Verifying GPS Jitter Duplicate Prevention...');

  // Simulate multiple GPS readings with slight coordinate jitter (10-30 meters)
  const jitterLoc1: ActiveLocation = {
    id: `loc-device-jitter-1-${Date.now()}`,
    name: 'Current Location',
    latitude: 22.6171,
    longitude: 88.4225,
    accuracy: 15,
    source: 'device',
    timestamp: new Date().toISOString(),
  };

  const jitterLoc2: ActiveLocation = {
    id: `loc-device-jitter-2-${Date.now()}`,
    name: 'Current Location',
    latitude: 22.6173,
    longitude: 88.4227,
    accuracy: 20,
    source: 'device',
    timestamp: new Date().toISOString(),
  };

  const p1 = await persistActiveLocation(jitterLoc1);
  assert.strictEqual(p1, true, 'First device jitter location must be persisted.');

  const p2 = await persistActiveLocation(jitterLoc2);
  assert.strictEqual(p2, true, 'Second device jitter location must update in-place.');

  // Retrieve saved locations
  const recentSaved = await getRecentPersistedLocations(5);
  assert(recentSaved.length > 0, 'Saved locations must not be empty.');

  // Filter for Current Location
  const currentLocationEntries = recentSaved.filter(
    (loc) => loc.name === 'Current Location' || loc.source === 'device'
  );

  assert.strictEqual(
    currentLocationEntries.length,
    1,
    `Expected exactly 1 "Current Location" in saved locations, but found ${currentLocationEntries.length}.`
  );

  // Verify the latest coordinates were preserved
  const activeCurrentLoc = currentLocationEntries[0];
  assert.strictEqual(activeCurrentLoc.latitude, 22.6173);
  assert.strictEqual(activeCurrentLoc.longitude, 88.4227);
  assert.strictEqual(activeCurrentLoc.source, 'device');
  console.log('✔ Device GPS jitter deduplication verified (at most 1 Current Location).\n');

  // --------------------------------------------------------------------------
  // Test 3: Coordinate Proximity Deduplication & Valid Locations Retention
  // --------------------------------------------------------------------------
  console.log('[3/3] Test 3: Verifying Coordinate Uniqueness and Retention of Valid Locations...');
  
  // Persist a known city (e.g. Paris)
  const parisLoc: ActiveLocation = {
    id: `loc-paris-test-${Date.now()}`,
    name: 'Paris',
    country: 'France',
    admin1: 'Île-de-France',
    latitude: 48.8566,
    longitude: 2.3522,
    timezone: 'Europe/Paris',
    source: 'manual',
    timestamp: new Date().toISOString(),
  };

  const pParis = await persistActiveLocation(parisLoc);
  assert.strictEqual(pParis, true);

  const savedList = await getRecentPersistedLocations(5);
  
  // Verify no duplicate coordinates exist in the saved locations list
  const seenCoordinates = new Set<string>();
  for (const loc of savedList) {
    const key = `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
    assert.strictEqual(
      seenCoordinates.has(key),
      false,
      `Duplicate coordinate found in saved locations: ${key} (${loc.name})`
    );
    seenCoordinates.add(key);
  }

  // Verify Paris is at index 0 (most recent)
  assert.strictEqual(savedList[0].name, 'Paris');
  console.log('✔ Coordinate uniqueness and recent ordering confirmed.\n');

  console.log('======================================================');
  console.log('ALL STEP 1 CLEANUP REGRESSION TESTS PASSED! ✔');
  console.log('======================================================\n');
}

runStep1CleanupRegressionTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
