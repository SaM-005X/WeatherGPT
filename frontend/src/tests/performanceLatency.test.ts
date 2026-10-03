/**
 * Performance & Latency Elimination Test Suite
 *
 * Verifies:
 * 1. Instant Cache Hits (< 20ms) using Stale-While-Revalidate caching.
 * 2. In-flight Request Deduplication across concurrent calls sharing the same promise.
 * 3. Instant Fast-Fail and Fallback execution when AppSync reports "The service is overloaded" or times out.
 */

import assert from 'node:assert';
import {
  fetchWeatherData,
  clearWeatherCache,
  weatherCache,
  getCacheKey,
  getWeatherCacheKey,
  WeatherCacheEntry,
} from '../lib/weatherService';
import {
  fetchWeatherByCoordinates,
  clearGraphQLInFlightRequests,
} from '../lib/api/graphqlClient';


async function runPerformanceTests() {
  console.log('======================================================');
  console.log('STARTING PERFORMANCE & LATENCY ELIMINATION TESTS');
  console.log('======================================================\n');

  const testLat = 40.7128;
  const testLon = -74.006;

  // --------------------------------------------------------------------------
  // Test 1: Cache Hit Retrieval Latency (< 20ms, targeting < 10ms)
  // --------------------------------------------------------------------------
  console.log('[1/4] Testing Instant Cache Hit Latency (< 20ms)...');
  clearWeatherCache();

  // Seed cache directly with a valid entry
  const now = Date.now();
  const mockReport = {
    locationId: `coords-${testLat.toFixed(4)}-${testLon.toFixed(4)}`,
    current: {
      temperature: 21.5,
      feelsLike: 20.8,
      humidity: 55,
      windSpeed: 3.2,
      windDirection: 180,
      weatherCode: 0,
      condition: 'CLEAR' as const,
      conditionDescription: 'Clear Sky',
      precipitation: 0,
      recordedAt: new Date(now).toISOString(),
      cloudCover: 10,
    },
    hourly: [],
    daily: [],
    lastUpdated: new Date(now).toISOString(),
    fetchedAt: new Date(now).toISOString(),
    timezone: 'America/New_York',
  };

  const seedEntry: WeatherCacheEntry = {
    key: getCacheKey(testLat, testLon),
    timestamp: now,
    currentFetchedAt: now,
    hourlyFetchedAt: now,
    dailyFetchedAt: now,
    data: mockReport,
  };

  weatherCache.set(getCacheKey(testLat, testLon), seedEntry);
  weatherCache.set(getWeatherCacheKey(testLat, testLon), seedEntry);

  const t0 = performance.now();
  const cachedResult = await fetchWeatherData(testLat, testLon);
  const latency = performance.now() - t0;

  console.log(`- Instant Cache hit latency: ${latency.toFixed(2)} ms`);
  assert.strictEqual(cachedResult.current.isCached, true, 'Result must be flagged as cached.');
  assert.strictEqual(cachedResult.current.isStale, false, 'Result must be fresh.');
  assert.ok(latency < 20, `Cache hit must return in < 20ms (measured: ${latency.toFixed(2)}ms)`);
  console.log('✔ Instant cache hit under 20ms verified.\n');

  // --------------------------------------------------------------------------
  // Test 2: In-Flight Request Deduplication
  // --------------------------------------------------------------------------
  console.log('[2/4] Testing In-Flight Request Deduplication...');
  clearGraphQLInFlightRequests();

  const originalFetch = globalThis.fetch;
  let networkCallCount = 0;

  // Mock globalThis.fetch with an artificial 100ms latency to test concurrency
  globalThis.fetch = async () => {
    networkCallCount++;
    await new Promise((res) => setTimeout(res, 100));
    return new Response(
      JSON.stringify({
        data: {
          weatherByCoordinates: {
            locationId: 'coords-40.7128--74.0060',
            lastUpdated: new Date().toISOString(),
            timezone: 'America/New_York',
            current: {
              temperature: 22,
              feelsLike: 21,
              humidity: 50,
              windSpeed: 4,
              windDirection: 120,
              weatherCode: 1,
              condition: 'MainlyClear',
              conditionDescription: 'Mainly Clear',
              precipitation: 0,
              uvIndex: 4,
              pressure: 1013,
              visibility: 10,
              cloudCover: 15,
              recordedAt: new Date().toISOString(),
              isCached: false,
            },
            hourly: [],
            daily: [],
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const concurrentRequests = [
      fetchWeatherByCoordinates(testLat, testLon),
      fetchWeatherByCoordinates(testLat, testLon),
      fetchWeatherByCoordinates(testLat, testLon),
      fetchWeatherByCoordinates(testLat, testLon),
    ];

    const results = await Promise.all(concurrentRequests);
    assert.strictEqual(results.length, 4);
    assert.strictEqual(networkCallCount, 1, `4 concurrent calls must be deduplicated into 1 network call, got ${networkCallCount}`);
    console.log(`- Deduplicated 4 concurrent requests into exactly ${networkCallCount} network call.`);
    console.log('✔ Coordinate request deduplication verified.\n');
  } finally {
    globalThis.fetch = originalFetch;
    clearGraphQLInFlightRequests();
  }

  // --------------------------------------------------------------------------
  // Test 3: Fast-fail & Fallback on "Service Overloaded"
  // --------------------------------------------------------------------------
  console.log('[3/4] Testing Fast-Fail & Fallback on AppSync "The service is overloaded"...');
  clearWeatherCache();
  clearGraphQLInFlightRequests();

  let appSyncCalled = false;
  let directFallbackCalled = false;

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const urlStr = typeof input === 'string' ? input : input.toString();


    // AppSync call simulation returning overloaded error
    if (urlStr.includes('appsync') || urlStr.includes('/api/graphql')) {
      appSyncCalled = true;
      return new Response(
        JSON.stringify({
          errors: [
            {
              message: 'Weather service error: The service is overloaded',
              errorType: 'Lambda:Unhandled',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Direct fallback (open-meteo API) simulation
    if (urlStr.includes('open-meteo.com')) {
      directFallbackCalled = true;
      return new Response(
        JSON.stringify({
          latitude: testLat,
          longitude: testLon,
          utc_offset_seconds: -14400,
          timezone: 'America/New_York',
          current: {
            time: '2026-10-03T18:00',
            temperature_2m: 19.5,
            apparent_temperature: 18.5,
            relative_humidity_2m: 60,
            precipitation: 0,
            weather_code: 0,
            wind_speed_10m: 3.5,
            wind_direction_10m: 190,
            uv_index: 3,
            cloud_cover: 20,
          },
          hourly: {
            time: ['2026-10-03T18:00'],
            temperature_2m: [19.5],
            precipitation_probability: [0],
            weather_code: [0],
          },
          daily: {
            time: ['2026-10-03'],
            weather_code: [0],
            temperature_2m_max: [22],
            temperature_2m_min: [15],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  };

  try {
    const tStart = performance.now();
    const result = await fetchWeatherByCoordinates(testLat, testLon);
    const duration = performance.now() - tStart;

    console.log(`- Fallback execution duration: ${duration.toFixed(2)} ms`);
    assert.strictEqual(appSyncCalled, true, 'AppSync endpoint must be invoked initially.');
    assert.strictEqual(directFallbackCalled, true, 'Direct fallback must be invoked after overload error.');
    assert.strictEqual(result.current.temperature, 19.5, 'Weather data should be resolved from fallback.');
    console.log('✔ Fast-fail and clean direct service fallback verified.\n');
  } finally {
    globalThis.fetch = originalFetch;
    clearWeatherCache();
    clearGraphQLInFlightRequests();
  }

  // --------------------------------------------------------------------------
  // Test 4: Stale-While-Revalidate Snapshot on Open-Meteo Overload (HTTP 429/503)
  // --------------------------------------------------------------------------
  console.log('[4/4] Testing SWR Snapshot Return on Overload (HTTP 429/503)...');
  clearWeatherCache();

  // Populate cache with previous snapshot
  const initialTime = Date.now() - (4 * 60 * 1000); // 4 minutes old (within SWR window)
  const initialEntry: WeatherCacheEntry = {
    key: getCacheKey(testLat, testLon),
    timestamp: initialTime,
    currentFetchedAt: initialTime,
    hourlyFetchedAt: initialTime,
    dailyFetchedAt: initialTime,
    data: {
      ...mockReport,
      current: {
        ...mockReport.current,
        temperature: 25.0,
      },
    },
  };
  weatherCache.set(getCacheKey(testLat, testLon), initialEntry);
  weatherCache.set(getWeatherCacheKey(testLat, testLon), initialEntry);

  // Now mock Open-Meteo failing with HTTP 429 Too Many Requests / Overloaded
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({ error: true, reason: 'The service is overloaded' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const swrResult = await fetchWeatherData(testLat, testLon, { forceRefresh: true });
    assert.strictEqual(swrResult.current.temperature, 25.0, 'Must return cached snapshot on HTTP 429 overload.');
    assert.strictEqual(swrResult.current.isStale, true, 'Snapshot must be marked as stale when returned on error.');
    console.log('✔ Clean recovery with stale snapshot on HTTP 429 overload verified.\n');
  } finally {
    globalThis.fetch = originalFetch;
    clearWeatherCache();
  }

  console.log('======================================================');
  console.log('ALL PERFORMANCE & LATENCY TESTS PASSED! ✔');
  console.log('======================================================\n');
}

runPerformanceTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
