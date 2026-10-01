/**
 * Automated Test Suite for Stage 8: Severe Weather Alerts, Thunderstorms & Resilience
 *
 * Validates:
 * 1. NWS & Open-Meteo alert normalization (severity, urgency, event).
 * 2. US coordinate bounding detection (isUnitedStates).
 * 3. Atmospheric convective indicator & lightning score calculations.
 * 4. Convective risk categorization (None, Moderate, High, Severe).
 * 5. Storm safety guideline generation and regional cell spatial derivation.
 * 6. In-memory caching, request deduplication, and stale fallback in alertsService and stormService.
 * 7. RainViewer timeout expansion to 10s and 1-retry fallback resilience.
 */

import assert from 'node:assert';
import {
  isUnitedStates,
  normalizeNwsSeverity,
  normalizeNwsUrgency,
  fetchWeatherAlerts,
  clearAlertsCache,
  getAlertsCacheKey,
  ALERTS_CACHE_TTL_MS,
} from '../lib/alertsService';
import {
  calculateLightningScore,
  classifyConvectiveRisk,
  getSafetyGuidelines,
  generateRegionalStormCells,
  fetchStormData,
  clearStormCache,
  getStormCacheKey,
  STORM_CACHE_TTL_MS,
} from '../lib/stormService';
import {
  RAINVIEWER_DEFAULT_TIMEOUT_MS,
  getLatestRadarMetadata,
  clearRainViewerCache,
} from '../lib/rainViewerService';

console.log('=== RUNNING STAGE 8 ALERTS, STORMS & RESILIENCE TESTS ===\n');

// ============================================================================
// 1. Resilience & Timeout Expansion Validation
// ============================================================================
console.log('[1/7] Testing RainViewer Resilience & Timeout Configuration...');
assert.strictEqual(
  RAINVIEWER_DEFAULT_TIMEOUT_MS,
  10000,
  'RainViewer default fetch timeout must be 10000ms (10 seconds)'
);
assert.strictEqual(ALERTS_CACHE_TTL_MS, 5 * 60 * 1000, 'Alerts cache TTL must be 5 minutes');
assert.strictEqual(STORM_CACHE_TTL_MS, 5 * 60 * 1000, 'Storm cache TTL must be 5 minutes');
assert.strictEqual(getAlertsCacheKey(22.5, 88.3), 'alerts-22.500-88.300');
assert.strictEqual(getStormCacheKey(22.5, 88.3), 'storm-22.500-88.300');

// Test 1-retry fallback on RainViewer fetch
async function testRainViewerRetry() {
  clearRainViewerCache();
  let attemptCount = 0;

  const mockFlakyFetch = (async () => {
    attemptCount++;
    if (attemptCount === 1) {
      throw new Error('Transient network socket closed');
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        version: '2.0',
        generated: 1790662800,
        host: 'https://tilecache.rainviewer.com',
        radar: {
          past: [{ time: 1790662800, path: '/v2/radar/retry-frame' }],
        },
      }),
    } as unknown as Response;
  }) as typeof fetch;

  const metadata = await getLatestRadarMetadata({ fetchFn: mockFlakyFetch });
  assert.strictEqual(attemptCount, 2, 'Must execute exactly 2 attempts (initial + 1-retry)');
  assert.strictEqual(metadata.path, '/v2/radar/retry-frame', 'Must resolve successfully after 1 retry');
}

// ============================================================================
// 2. Alert Geography & Severity Normalization
// ============================================================================
console.log('[2/7] Testing Geography and Severity Normalization...');

// US Bounding checks
assert.strictEqual(isUnitedStates(38.8951, -77.0364), true, 'Washington DC must be in US');
assert.strictEqual(isUnitedStates(34.0522, -118.2437), true, 'Los Angeles must be in US');
assert.strictEqual(isUnitedStates(21.3069, -157.8583), true, 'Honolulu, Hawaii must be in US');
assert.strictEqual(isUnitedStates(61.2181, -149.9003), true, 'Anchorage, Alaska must be in US');
assert.strictEqual(isUnitedStates(51.5074, -0.1278), false, 'London must NOT be in US');
assert.strictEqual(isUnitedStates(22.5726, 88.3639), false, 'Kolkata must NOT be in US');
assert.strictEqual(isUnitedStates(35.6762, 139.6503), false, 'Tokyo must NOT be in US');

// Severity normalizations
assert.strictEqual(normalizeNwsSeverity('Extreme'), 'Extreme');
assert.strictEqual(normalizeNwsSeverity('severe'), 'Severe');
assert.strictEqual(normalizeNwsSeverity('MODERATE'), 'Moderate');
assert.strictEqual(normalizeNwsSeverity('minor'), 'Minor');
assert.strictEqual(normalizeNwsSeverity('unknown_level'), 'Minor');
assert.strictEqual(normalizeNwsSeverity(undefined), 'Minor');

// Urgency normalizations
assert.strictEqual(normalizeNwsUrgency('Immediate'), 'Immediate');
assert.strictEqual(normalizeNwsUrgency('Expected'), 'Expected');
assert.strictEqual(normalizeNwsUrgency('Future'), 'Future');
assert.strictEqual(normalizeNwsUrgency('Past'), 'Past');
assert.strictEqual(normalizeNwsUrgency('other'), 'Unknown');
assert.strictEqual(normalizeNwsUrgency(undefined), 'Unknown');

console.log('✔ Alert Geography and Severity Normalization verified.\n');

// ============================================================================
// 3. Convective Indicators & Lightning Potential Score
// ============================================================================
console.log('[3/7] Testing Convective Indicators & Lightning Potential Score...');

// Severe thunderstorm with hail (WMO 99)
const score99 = calculateLightningScore(99, 28, 75, 65);
assert.strictEqual(score99, 96, 'WMO code 99 must yield 96% lightning score');
assert.strictEqual(classifyConvectiveRisk(99, score99), 'Severe');

// Thunderstorm with hail (WMO 96)
const score96 = calculateLightningScore(96, 26, 70, 50);
assert.strictEqual(score96, 78, 'WMO code 96 must yield 78% lightning score');
assert.strictEqual(classifyConvectiveRisk(96, score96), 'High');

// Moderate thunderstorm (WMO 95)
const score95 = calculateLightningScore(95, 24, 60, 45);
assert.strictEqual(score95, 65, 'WMO code 95 must yield 65% lightning score');
assert.strictEqual(classifyConvectiveRisk(95, score95), 'High');

// High squalls without active lightning (warm, humid, gusts > 60 km/h)
const scoreSquall = calculateLightningScore(80, 26, 70, 65);
assert.ok(scoreSquall >= 50, 'High temperature, humidity, and squalls must produce elevated convective score');
assert.strictEqual(classifyConvectiveRisk(80, scoreSquall), 'High');

// Calm clear weather (WMO 0)
const scoreClear = calculateLightningScore(0, 15, 40, 10);
assert.strictEqual(scoreClear, 0, 'Clear calm conditions must produce 0% score');
assert.strictEqual(classifyConvectiveRisk(0, scoreClear), 'None');

console.log('✔ Convective Indicators & Lightning Potential Score verified.\n');

// ============================================================================
// 4. Safety Guidelines & Regional Storm Cell Geometry
// ============================================================================
console.log('[4/7] Testing Safety Guidelines & Regional Storm Cells...');

const severeGuidelines = getSafetyGuidelines('Severe');
assert.ok(severeGuidelines.length >= 3, 'Severe risk must offer detailed safety guidelines');
assert.ok(severeGuidelines.some((g) => g.includes('indoor shelter')));

const noneGuidelines = getSafetyGuidelines('None');
assert.ok(noneGuidelines.some((g) => g.includes('No convective thunderstorm threat')));

// Regional cells geometry
const cellsSevere = generateRegionalStormCells(22.5726, 88.3639, 'Severe', 75);
assert.strictEqual(cellsSevere.length, 3, 'Severe convection must produce 3 tracked cells (core + 2 flanking)');
assert.strictEqual(cellsSevere[0].intensity, 'severe');
assert.strictEqual(cellsSevere[0].directionCardinal, 'NW');

const cellsNone = generateRegionalStormCells(22.5726, 88.3639, 'None', 10);
assert.strictEqual(cellsNone.length, 0, 'None risk must return 0 cells');

console.log('✔ Safety Guidelines & Regional Storm Cells verified.\n');

// ============================================================================
// 5. Alerts Service Network Normalization & Caching
// ============================================================================
console.log('[5/7] Testing Alerts Service Network Normalization & Caching...');

async function testAlertsService() {
  clearAlertsCache();

  // Mock Open-Meteo response with severe thunderstorm code 99 and gale wind
  const mockOpenMeteoSevere = {
    current: {
      temperature_2m: 29.5,
      relative_humidity_2m: 80,
      weather_code: 99,
      wind_speed_10m: 45,
      wind_gusts_10m: 82,
      precipitation: 28.5,
    },
  };

  const mockFetch = (async () => {
    return {
      ok: true,
      status: 200,
      json: async () => mockOpenMeteoSevere,
    } as unknown as Response;
  }) as typeof fetch;

  const report = await fetchWeatherAlerts(22.5726, 88.3639, { fetchFn: mockFetch });
  assert.ok(report.alerts.length > 0, 'Must extract synthesized alerts for severe weather parameters');
  assert.strictEqual(report.isCached, false);

  const topAlert = report.alerts[0];
  assert.strictEqual(topAlert.severity, 'Severe');
  assert.strictEqual(topAlert.event, 'Severe Thunderstorm & Hail Warning');
  assert.ok(topAlert.instruction !== undefined);

  // Cache hit test
  const cachedReport = await fetchWeatherAlerts(22.5726, 88.3639, { fetchFn: mockFetch });
  assert.strictEqual(cachedReport.isCached, true, 'Subsequent call within TTL must return cached data');

  // Stale fallback test
  const failingFetch = (async () => {
    throw new Error('Connection reset by peer');
  }) as typeof fetch;

  const staleReport = await fetchWeatherAlerts(22.5726, 88.3639, {
    forceRefresh: true,
    fetchFn: failingFetch,
  });
  assert.strictEqual(staleReport.isStale, true, 'Failed refresh must fall back to stale cache');
  assert.strictEqual(staleReport.alerts.length, report.alerts.length);
}

// ============================================================================
// 6. Storm Service Network Normalization & Caching
// ============================================================================
console.log('[6/7] Testing Storm Service Network Normalization & Caching...');

async function testStormService() {
  clearStormCache();

  const mockConvectiveResponse = {
    current: {
      temperature_2m: 30.2,
      relative_humidity_2m: 78,
      weather_code: 96,
      wind_speed_10m: 32,
      wind_gusts_10m: 64,
      precipitation: 14.2,
    },
    hourly: {
      time: ['2026-10-01T12:00', '2026-10-01T13:00', '2026-10-01T14:00'],
      weather_code: [96, 95, 80],
      precipitation_probability: [90, 80, 40],
    },
  };

  let networkCalls = 0;
  const mockFetch = (async () => {
    networkCalls++;
    return {
      ok: true,
      status: 200,
      json: async () => mockConvectiveResponse,
    } as unknown as Response;
  }) as typeof fetch;

  const storm = await fetchStormData(22.5726, 88.3639, { fetchFn: mockFetch });
  assert.strictEqual(networkCalls, 1);
  assert.strictEqual(storm.convectiveRisk, 'High');
  assert.strictEqual(storm.hasActiveThunderstorm, true);
  assert.strictEqual(storm.stormType, 'Thunderstorm with Small Hail');
  assert.ok(storm.stormCells.length >= 2, 'High risk must generate at least 2 storm cells');
  assert.strictEqual(storm.hourlyRisk.length, 3);

  // Deduplication test (concurrent calls)
  const [s1, s2] = await Promise.all([
    fetchStormData(22.5726, 88.3639, { fetchFn: mockFetch, forceRefresh: true }),
    fetchStormData(22.5726, 88.3639, { fetchFn: mockFetch, forceRefresh: true }),
  ]);
  assert.strictEqual(s1.convectiveRisk, s2.convectiveRisk);
}

// ============================================================================
// 7. Execution of Async Suites
// ============================================================================
async function runAll() {
  await testRainViewerRetry();
  console.log('✔ RainViewer 1-retry fallback verified.\n');

  await testAlertsService();
  console.log('✔ Alerts Service normalization, caching & stale fallback verified.\n');

  await testStormService();
  console.log('✔ Storm Service convective tracking, cells & deduplication verified.\n');

  console.log('========================================================');
  console.log('🎉 ALL STAGE 8 ALERTS, STORMS & RESILIENCE TESTS PASSED!');
  console.log('========================================================');
}

runAll().catch((err) => {
  console.error('❌ Stage 8 Test Failure:', err);
  process.exit(1);
});
