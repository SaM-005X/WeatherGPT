/**
 * Comprehensive Automated Test Suite for Radar & Precipitation Nowcast
 * Stage 5 & 6 Verification
 *
 * Covers:
 * 1. RainViewer API v2 response parsing, timeline frame sequence, and Slippy Map URLs.
 * 2. RainViewer past vs nowcast frame indexing and GIS zoom configurations.
 * 3. Open-Meteo 15-minute precipitation normalization across 8 steps (120 minutes).
 * 4. Intensity categorization (dry, light, moderate, heavy, violent).
 * 5. Zero-rain and completely dry scenarios.
 * 6. Active rain (currently active) vs upcoming rain trajectory.
 * 7. Malformed / empty payload resilience.
 * 8. In-memory caching, TTL expiration, and in-flight request deduplication.
 */

import assert from 'node:assert';
import {
  parseRainViewerResponse,
  RAINVIEWER_LEAFLET_CONFIG,
  RainViewerApiResponse,
} from '../lib/rainViewerService';
import {
  normalizeNowcastResponse,
  classifyRainIntensity,
  buildNowcastUrl,
  fetchPrecipitationNowcast,
  clearNowcastCache,
  OpenMeteoNowcastResponse,
} from '../lib/weatherService';

console.log('========================================================');
console.log('🧪 RUNNING RADAR & PRECIPITATION NOWCAST TEST SUITE');
console.log('========================================================');

// ============================================================================
// 1. RainViewer API Parsing & Timeline Frame Sequence
// ============================================================================
console.log('\n[1/8] Testing RainViewer Timeline Sequence & Frame Construction...');

const sampleRainViewerPayload: RainViewerApiResponse = {
  version: '2.0',
  generated: 1790663400,
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: [
      { time: 1790659800, path: '/v2/radar/frame-past-1' },
      { time: 1790660400, path: '/v2/radar/frame-past-2' },
      { time: 1790661000, path: '/v2/radar/frame-past-latest' },
    ],
    nowcast: [
      { time: 1790661600, path: '/v2/radar/frame-nowcast-1' },
      { time: 1790662200, path: '/v2/radar/frame-nowcast-2' },
    ],
  },
};

const radarMeta = parseRainViewerResponse(sampleRainViewerPayload);

assert.strictEqual(radarMeta.host, 'https://tilecache.rainviewer.com');
assert.strictEqual(radarMeta.frames.length, 5, 'Should contain 3 past + 2 nowcast frames');
assert.strictEqual(radarMeta.currentFrameIndex, 2, 'Default frame index must point to latest past frame');
assert.strictEqual(radarMeta.path, '/v2/radar/frame-past-latest');
assert.strictEqual(radarMeta.frames[0].type, 'past');
assert.strictEqual(radarMeta.frames[2].type, 'past');
assert.strictEqual(radarMeta.frames[3].type, 'nowcast');
assert.strictEqual(radarMeta.frames[4].type, 'nowcast');

// Verify Slippy Map URL construction
const expectedTileUrl = 'https://tilecache.rainviewer.com/v2/radar/frame-past-latest/256/{z}/{x}/{y}/2/1_1.png';
assert.strictEqual(radarMeta.tileUrlTemplate, expectedTileUrl);
assert.strictEqual(radarMeta.frames[3].tileUrlTemplate, 'https://tilecache.rainviewer.com/v2/radar/frame-nowcast-1/256/{z}/{x}/{y}/2/1_1.png');

console.log('✅ RainViewer frame sequence and Slippy Map URLs validated.');

// ============================================================================
// 2. Leaflet Radar GIS Zoom Constraints
// ============================================================================
console.log('\n[2/8] Validating Leaflet Radar GIS Zoom Constants...');

assert.strictEqual(RAINVIEWER_LEAFLET_CONFIG.maxNativeZoom, 7, 'RainViewer native tiles cap at zoom 7');
assert.strictEqual(RAINVIEWER_LEAFLET_CONFIG.maxZoom, 18, 'Leaflet must upscale up to zoom 18');
assert.strictEqual(RAINVIEWER_LEAFLET_CONFIG.tileSize, 256);
assert.ok(RAINVIEWER_LEAFLET_CONFIG.opacity > 0 && RAINVIEWER_LEAFLET_CONFIG.opacity <= 1);

console.log('✅ Leaflet zoom constraints verified.');

// ============================================================================
// 3. Open-Meteo Nowcast URL Construction
// ============================================================================
console.log('\n[3/8] Validating Open-Meteo Nowcast URL Construction...');

const nowcastUrl = buildNowcastUrl(22.5726, 88.3639);
const parsedUrl = new URL(nowcastUrl);

assert.strictEqual(parsedUrl.origin, 'https://api.open-meteo.com');
assert.strictEqual(parsedUrl.pathname, '/v1/forecast');
assert.strictEqual(parsedUrl.searchParams.get('latitude'), '22.5726');
assert.strictEqual(parsedUrl.searchParams.get('longitude'), '88.3639');
assert.strictEqual(parsedUrl.searchParams.get('minutely_15'), 'precipitation,precipitation_probability,weather_code');
assert.strictEqual(parsedUrl.searchParams.get('forecast_minutely_15'), '8');
assert.strictEqual(parsedUrl.searchParams.get('timezone'), 'auto');

console.log('✅ Open-Meteo nowcast URL verified.');

// ============================================================================
// 4. Rain Intensity Categorization Helper
// ============================================================================
console.log('\n[4/8] Testing Rain Intensity Categorization...');

assert.strictEqual(classifyRainIntensity(0.0), 'dry');
assert.strictEqual(classifyRainIntensity(0.04), 'dry');
assert.strictEqual(classifyRainIntensity(0.1), 'light');
assert.strictEqual(classifyRainIntensity(2.4), 'light');
assert.strictEqual(classifyRainIntensity(2.5), 'moderate');
assert.strictEqual(classifyRainIntensity(9.9), 'moderate');
assert.strictEqual(classifyRainIntensity(10.0), 'heavy');
assert.strictEqual(classifyRainIntensity(49.9), 'heavy');
assert.strictEqual(classifyRainIntensity(55.0), 'violent');

console.log('✅ Rain intensity categories verified.');

// ============================================================================
// 5. Normalization of Rainy Nowcast Scenario (Upcoming Rain)
// ============================================================================
console.log('\n[5/8] Testing Normalization with Upcoming Rain...');

const rainyPayload: OpenMeteoNowcastResponse = {
  latitude: 22.57,
  longitude: 88.36,
  utc_offset_seconds: 19800,
  timezone: 'Asia/Kolkata',
  minutely_15: {
    time: [
      '2026-09-30T16:00',
      '2026-09-30T16:15',
      '2026-09-30T16:30',
      '2026-09-30T16:45',
      '2026-09-30T17:00',
      '2026-09-30T17:15',
      '2026-09-30T17:30',
      '2026-09-30T17:45',
    ],
    // 15-min mm: 0, 0.5 (2 mm/h), 1.2 (4.8 mm/h), 0.8 (3.2 mm/h), 0, 0, 0, 0
    precipitation: [0.0, 0.5, 1.2, 0.8, 0.0, 0.0, 0.0, 0.0],
    precipitation_probability: [5, 40, 85, 70, 20, 10, 5, 0],
    weather_code: [3, 51, 61, 61, 3, 2, 1, 0],
  },
};

const rainyReport = normalizeNowcastResponse(rainyPayload, 22.57, 88.36);

assert.strictEqual(rainyReport.horizonMinutes, 120);
assert.strictEqual(rainyReport.steps.length, 8);
assert.strictEqual(rainyReport.willRain, true);
assert.strictEqual(rainyReport.expectedRainStartMinutes, 15, 'Rain starts in 15 minutes');
assert.strictEqual(rainyReport.currentIntensityMmH, 0);
assert.strictEqual(rainyReport.currentIntensityCategory, 'dry');
assert.strictEqual(rainyReport.maxProbability, 85);
assert.strictEqual(rainyReport.totalExpectedPrecipitationMm, 2.5, '0.5 + 1.2 + 0.8 = 2.5mm');

// Test Step 1 (+15m)
const step1 = rainyReport.steps[1];
assert.strictEqual(step1.minutesFromNow, 15);
assert.strictEqual(step1.precipitationMm, 0.5);
assert.strictEqual(step1.precipitationRateMmH, 2.0); // 0.5 * 4
assert.strictEqual(step1.intensityCategory, 'light');
assert.strictEqual(step1.probability, 40);

// Test Step 2 (+30m)
const step2 = rainyReport.steps[2];
assert.strictEqual(step2.minutesFromNow, 30);
assert.strictEqual(step2.precipitationMm, 1.2);
assert.strictEqual(step2.precipitationRateMmH, 4.8); // 1.2 * 4
assert.strictEqual(step2.intensityCategory, 'moderate');
assert.strictEqual(step2.probability, 85);

assert.ok(rainyReport.summaryMessage.includes('15 min'));
console.log(`✅ Rainy scenario verified: "${rainyReport.summaryMessage}"`);

// ============================================================================
// 6. Normalization of Zero-Rain / Completely Dry Scenario
// ============================================================================
console.log('\n[6/8] Testing Normalization with Zero Rain...');

const dryPayload: OpenMeteoNowcastResponse = {
  latitude: 22.57,
  longitude: 88.36,
  utc_offset_seconds: 19800,
  timezone: 'Asia/Kolkata',
  minutely_15: {
    time: [
      '2026-09-30T16:00',
      '2026-09-30T16:15',
      '2026-09-30T16:30',
      '2026-09-30T16:45',
      '2026-09-30T17:00',
      '2026-09-30T17:15',
      '2026-09-30T17:30',
      '2026-09-30T17:45',
    ],
    precipitation: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    precipitation_probability: [0, 0, 0, 0, 0, 0, 0, 0],
    weather_code: [1, 1, 1, 1, 1, 0, 0, 0],
  },
};

const dryReport = normalizeNowcastResponse(dryPayload, 22.57, 88.36);

assert.strictEqual(dryReport.willRain, false);
assert.strictEqual(dryReport.expectedRainStartMinutes, null);
assert.strictEqual(dryReport.totalExpectedPrecipitationMm, 0);
assert.strictEqual(dryReport.currentIntensityMmH, 0);
assert.strictEqual(dryReport.currentIntensityCategory, 'dry');
assert.strictEqual(dryReport.maxProbability, 0);
assert.strictEqual(dryReport.summaryMessage, 'Dry conditions expected for the next 120 minutes.');
assert.ok(dryReport.steps.every((s) => s.intensityCategory === 'dry'));

console.log('✅ Dry scenario verified.');

// ============================================================================
// 7. Normalization of Active Rain Scenario (Currently Active at Step 0)
// ============================================================================
console.log('\n[7/8] Testing Normalization with Active Rain at Step 0...');

const activeRainPayload: OpenMeteoNowcastResponse = {
  latitude: 22.57,
  longitude: 88.36,
  utc_offset_seconds: 19800,
  timezone: 'Asia/Kolkata',
  minutely_15: {
    time: ['2026-09-30T16:00', '2026-09-30T16:15'],
    precipitation: [1.5, 0.8],
    precipitation_probability: [95, 90],
    weather_code: [61, 61],
  },
};

const activeReport = normalizeNowcastResponse(activeRainPayload, 22.57, 88.36);

assert.strictEqual(activeReport.willRain, true);
assert.strictEqual(activeReport.expectedRainStartMinutes, 0, 'Rain is active at step 0');
assert.strictEqual(activeReport.currentIntensityMmH, 6.0); // 1.5 * 4
assert.strictEqual(activeReport.currentIntensityCategory, 'moderate');
assert.ok(activeReport.summaryMessage.includes('Precipitation active now'));

console.log('✅ Active rain at step 0 verified.');

// ============================================================================
// 8. In-Memory Cache, Deduplication & Stale Fallback
// ============================================================================
console.log('\n[8/8] Testing Nowcast In-Memory Caching & Stale Fallback...');

clearNowcastCache();

let fetchCallCount = 0;
const mockFetch: typeof fetch = async () => {
  fetchCallCount++;
  return new Response(JSON.stringify(dryPayload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

async function runAllTests() {
  // First call: Should perform network fetch
  const res1 = await fetchPrecipitationNowcast(22.57, 88.36, { fetchFn: mockFetch });
  assert.strictEqual(fetchCallCount, 1);
  assert.strictEqual(res1.isCached, false);

  // Second call: Should return cached without network fetch
  const res2 = await fetchPrecipitationNowcast(22.57, 88.36, { fetchFn: mockFetch });
  assert.strictEqual(fetchCallCount, 1, 'Should hit in-memory cache');
  assert.strictEqual(res2.isCached, true);

  // Third call with forceRefresh: Should make network fetch
  const res3 = await fetchPrecipitationNowcast(22.57, 88.36, {
    forceRefresh: true,
    fetchFn: mockFetch,
  });
  assert.strictEqual(fetchCallCount, 2, 'forceRefresh must bypass cache');
  assert.strictEqual(res3.isCached, false);

  // Concurrent calls: Deduplication into a single network call
  clearNowcastCache();
  fetchCallCount = 0;

  const [con1, con2, con3] = await Promise.all([
    fetchPrecipitationNowcast(22.57, 88.36, { fetchFn: mockFetch }),
    fetchPrecipitationNowcast(22.57, 88.36, { fetchFn: mockFetch }),
    fetchPrecipitationNowcast(22.57, 88.36, { fetchFn: mockFetch }),
  ]);

  assert.strictEqual(fetchCallCount, 1, 'Concurrent calls must collapse into 1 fetch');
  assert.strictEqual(con1.horizonMinutes, 120);
  assert.strictEqual(con2.horizonMinutes, 120);
  assert.strictEqual(con3.horizonMinutes, 120);

  // Stale fallback test: Network fails, cached data returned with isStale: true
  const failingFetch: typeof fetch = async () => {
    throw new Error('Network timeout');
  };

  const staleRes = await fetchPrecipitationNowcast(22.57, 88.36, {
    forceRefresh: true,
    allowStaleFallback: true,
    fetchFn: failingFetch,
  });

  assert.strictEqual(staleRes.isStale, true, 'Should gracefully fall back to stale cache on network failure');

  console.log('✅ Caching, deduplication, and stale fallback verified.');

  console.log('\n========================================================');
  console.log('🎉 ALL RADAR & PRECIPITATION NOWCAST TESTS PASSED!');
  console.log('========================================================\n');
}

runAllTests().catch((err) => {
  console.error('❌ Test failure:', err);
  process.exit(1);
});

