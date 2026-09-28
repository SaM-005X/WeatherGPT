/**
 * Phase 7.2 Performance & In-Flight Abort Regression Test Suite
 *
 * Verifies that:
 * 1. Independent in-flight request deduplication is resilient to individual caller AbortSignal aborts.
 * 2. When one caller aborts (e.g. React StrictMode unmount, rapid tab switch, or navigation),
 *    the underlying network request is NOT torn down for concurrent callers.
 * 3. Concurrent callers receive valid data successfully without throwing AbortError.
 * 4. The shared cache is populated accurately so subsequent location switches or re-mounts resolve instantly.
 */

import assert from 'node:assert';
import { fetchWeatherData, clearWeatherCache, getCacheStatus } from '../lib/weatherService';
import { WeatherReport } from '../types/weather';

async function runInFlightAbortRegressionTests() {
  console.log('=== RUNNING PHASE 7.2 IN-FLIGHT ABORT REGRESSION TESTS ===\n');

  clearWeatherCache();
  const testLat = 51.5074;
  const testLon = -0.1278;

  // --------------------------------------------------------------------------
  // Test 1: Caller cancellation isolation during in-flight deduplication
  // --------------------------------------------------------------------------
  console.log('[1/3] Testing caller cancellation isolation during in-flight deduplication...');
  const c1 = new AbortController();
  const c2 = new AbortController();

  // Caller 1 starts fetch
  const p1 = fetchWeatherData(testLat, testLon, { signal: c1.signal });

  // Caller 2 initiates concurrent request for the same coordinates
  const p2 = fetchWeatherData(testLat, testLon, { signal: c2.signal });

  // Caller 1 aborts (simulating React StrictMode unmount or component unmount)
  c1.abort();

  let p1Error: Error | null = null;
  let p2Data: WeatherReport | null = null;

  try {
    await p1;
  } catch (err: unknown) {
    p1Error = err instanceof Error ? err : new Error(String(err));
  }

  try {
    p2Data = await p2;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert.fail(`Caller 2 should NOT have failed when Caller 1 aborted: ${msg}`);
  }

  assert.ok(p1Error, 'Caller 1 must reject upon abort.');
  assert.strictEqual(p1Error.name, 'AbortError', 'Caller 1 must reject specifically with AbortError.');
  assert.ok(p2Data, 'Caller 2 must receive valid WeatherReport.');
  assert.ok(typeof p2Data.current.temperature === 'number', 'Caller 2 must have numeric temperature.');
  console.log(`   Caller 1 rejected with expected: ${p1Error.name}`);
  console.log(`   Caller 2 resolved with temperature: ${p2Data.current.temperature}°C`);
  console.log('✔ Caller cancellation isolation verified.\n');

  // --------------------------------------------------------------------------
  // Test 2: In-flight completion populates cache for instant re-access
  // --------------------------------------------------------------------------
  console.log('[2/3] Verifying memory cache populated after isolated fetch...');
  const cacheStatus = getCacheStatus(testLat, testLon);
  assert.strictEqual(cacheStatus.isCached, true, 'Cache must be populated after in-flight completion.');
  assert.strictEqual(cacheStatus.isCurrentFresh, true, 'Cache entry must be marked fresh.');

  const tStart = Date.now();
  const cachedData = await fetchWeatherData(testLat, testLon);
  const durationMs = Date.now() - tStart;
  assert.strictEqual(cachedData.current.isCached, true, 'Subsequent call must be served from cache.');
  assert.strictEqual(cachedData.current.temperature, p2Data.current.temperature, 'Cached temperature must match.');
  assert.ok(durationMs < 20, `Cached call must resolve in < 20ms (took ${durationMs}ms).`);
  console.log(`   Instant cache response took: ${durationMs}ms`);
  console.log('✔ Cache population verified.\n');

  // --------------------------------------------------------------------------
  // Test 3: Rapid switching between locations (Kolkata -> London -> Kolkata)
  // --------------------------------------------------------------------------
  console.log('[3/3] Testing rapid sequential location switching without abort collisions...');
  const kolkataLat = 22.5726;
  const kolkataLon = 88.3639;

  const kolkataCtrl1 = new AbortController();
  const kolkataPromise1 = fetchWeatherData(kolkataLat, kolkataLon, { signal: kolkataCtrl1.signal });

  // Rapidly switch away to London
  kolkataCtrl1.abort();
  const londonData = await fetchWeatherData(testLat, testLon);
  assert.ok(londonData, 'London data must load.');

  // Wait for Kolkata background completion
  let kolkataAbortedErr: Error | null = null;
  try {
    await kolkataPromise1;
  } catch (err: unknown) {
    kolkataAbortedErr = err instanceof Error ? err : new Error(String(err));
  }
  assert.strictEqual(kolkataAbortedErr?.name, 'AbortError');

  // Switch back to Kolkata (should now resolve cleanly or hit cache)
  const kolkataData2 = await fetchWeatherData(kolkataLat, kolkataLon);
  assert.ok(kolkataData2, 'Kolkata must load successfully on revisit.');
  assert.ok(typeof kolkataData2.current.temperature === 'number');
  console.log(`   Kolkata revisited temperature: ${kolkataData2.current.temperature}°C`);
  console.log('✔ Rapid sequential location switching verified.\n');

  console.log('======================================================');
  console.log('ALL 3 PHASE 7.2 REGRESSION TESTS PASSED! ✔');
  console.log('======================================================\n');
}

runInFlightAbortRegressionTests().catch((err) => {
  console.error('Phase 7.2 Regression Test Suite Failed:', err);
  process.exit(1);
});
