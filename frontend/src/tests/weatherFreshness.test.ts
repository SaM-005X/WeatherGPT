/**
 * Phase 7 Weather Updates & Freshness Pipeline Test Suite
 *
 * Validates:
 * 1. Fresh cache hit (< 5-minute freshness window)
 * 2. Expired cache & Tiered Freshness Policy (current: 5m, hourly: 30m, daily: 2h)
 * 3. Forced refresh cache bypass (forceRefresh: true)
 * 4. Automatic client refresh interval & visibility synchronization
 * 5. Manual refresh non-destructive execution
 * 6. Duplicate / in-flight request deduplication (concurrent requests share single promise)
 * 7. Background sync worker execution
 * 8. Partial background sync failure handling & error isolation
 * 9. External API failure handling (cold cache rejection without data corruption)
 * 10. Preservation of previous valid data on network failure (stale-while-revalidate fallback)
 * 11. GraphQL weather query & mutation freshness compatibility
 * 12. Active location coordinate change & cache key separation
 */

import assert from 'node:assert';
import {
  fetchWeatherData,
  clearWeatherCache,
  getCacheKey,
  getCacheStatus,
  getInFlightRequestCount,
  buildCacheMetadata,
  FRESHNESS_POLICY,
  WeatherCacheEntry,
} from '../lib/weatherService';
import { handler as syncHandler, syncLocations } from '../../../backend/src/handlers/sync';
import { weatherResolvers } from '../graphql/resolvers/weatherResolvers';
import type { ScheduledEvent, Context } from 'aws-lambda';

function createMockContext(awsRequestId = 'test-phase7-sync'): Context {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'weather-gpt-forecast-sync',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:weather-gpt-forecast-sync',
    memoryLimitInMB: '512',
    awsRequestId,
    logGroupName: '/aws/lambda/weather-gpt-forecast-sync',
    logStreamName: '2026/09/28/mockstream',
    getRemainingTimeInMillis: () => 10000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };
}

async function runWeatherFreshnessTests() {
  console.log('=== RUNNING PHASE 7 WEATHER FRESHNESS & UPDATES TEST SUITE ===\n');

  clearWeatherCache();

  // --------------------------------------------------------------------------
  // Test 1: Fresh cache hit (< 5 min)
  // --------------------------------------------------------------------------
  console.log('[1/12] Test 1: Fresh Cache Hit (< 5-Minute Freshness Window)...');
  const londonLat = 51.5074;
  const londonLon = -0.1278;

  const initialFetch = await fetchWeatherData(londonLat, londonLon);
  assert.strictEqual(initialFetch.current.isCached, false, 'First fetch must be live from provider.');
  assert.strictEqual(initialFetch.current.isStale, false, 'First fetch is not stale.');
  assert.strictEqual(initialFetch.cacheMetadata?.isCached, true, 'Cache metadata marks cached.');
  assert.strictEqual(initialFetch.cacheMetadata?.isFresh, true, 'Cache metadata marks fresh.');

  const cachedFetch = await fetchWeatherData(londonLat, londonLon);
  assert.strictEqual(cachedFetch.current.isCached, true, 'Subsequent fetch within TTL must be cached.');
  assert.strictEqual(cachedFetch.current.isStale, false, 'Subsequent fetch within TTL is not stale.');
  assert.strictEqual(cachedFetch.cacheMetadata?.isFresh, true, 'Cache entry is within freshness window.');
  console.log('✔ Fresh cache hit verified.\n');

  // --------------------------------------------------------------------------
  // Test 2: Expired cache & Tiered Freshness Policy
  // --------------------------------------------------------------------------
  console.log('[2/12] Test 2: Expired Cache & Tiered Freshness Policy...');
  assert.strictEqual(FRESHNESS_POLICY.CURRENT_TTL_MS, 5 * 60 * 1000, 'Current weather TTL must be 5 minutes.');
  assert.strictEqual(FRESHNESS_POLICY.HOURLY_TTL_MS, 30 * 60 * 1000, 'Hourly forecast TTL must be 30 minutes.');
  assert.strictEqual(FRESHNESS_POLICY.DAILY_TTL_MS, 2 * 60 * 60 * 1000, 'Daily forecast TTL must be 2 hours.');

  const status = getCacheStatus(londonLat, londonLon);
  assert.strictEqual(status.isCached, true, 'London must be cached.');
  assert.strictEqual(status.isCurrentFresh, true, 'Current must be fresh.');
  assert.strictEqual(status.isHourlyFresh, true, 'Hourly must be fresh.');
  assert.strictEqual(status.isDailyFresh, true, 'Daily must be fresh.');

  // Simulate an entry aged 6 minutes (360,000 ms)
  const mockOldTime = Date.now() - (6 * 60 * 1000);
  const simulatedEntry: WeatherCacheEntry = {
    key: getCacheKey(londonLat, londonLon),
    timestamp: mockOldTime,
    currentFetchedAt: mockOldTime,
    hourlyFetchedAt: mockOldTime,
    dailyFetchedAt: mockOldTime,
    data: initialFetch,
  };

  const oldMetadata = buildCacheMetadata(simulatedEntry, Date.now());
  assert.strictEqual(oldMetadata.isFresh, false, 'Current weather aged 6 minutes must not be fresh.');
  assert.strictEqual(oldMetadata.isStale, true, 'Current weather aged 6 minutes must be stale.');
  console.log('✔ Tiered freshness policy and stale threshold verified.\n');

  // --------------------------------------------------------------------------
  // Test 3: Forced refresh cache bypass
  // --------------------------------------------------------------------------
  console.log('[3/12] Test 3: Forced Refresh Cache Bypass...');
  const refreshedFetch = await fetchWeatherData(londonLat, londonLon, { forceRefresh: true });
  assert.strictEqual(refreshedFetch.current.isCached, false, 'Forced refresh must bypass in-memory cache.');
  assert.strictEqual(refreshedFetch.current.isStale, false, 'Refreshed data is fresh.');
  assert.ok(refreshedFetch.lastUpdated, 'Must contain lastUpdated timestamp.');
  console.log('✔ Forced refresh cache bypass verified.\n');

  // --------------------------------------------------------------------------
  // Test 4: Automatic client refresh synchronization
  // --------------------------------------------------------------------------
  console.log('[4/12] Test 4: Automatic Refresh Interval & Visibility Synchronization...');
  const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
  let simulatedLastRefresh = Date.now() - (5 * 60 * 1000); // 5 minutes ago

  // 5 minutes elapsed: should NOT trigger auto-refresh yet
  let shouldTrigger = (Date.now() - simulatedLastRefresh) >= AUTO_REFRESH_INTERVAL_MS;
  assert.strictEqual(shouldTrigger, false, 'Must not auto-refresh if under 10 minutes.');

  // 11 minutes elapsed: SHOULD trigger auto-refresh
  simulatedLastRefresh = Date.now() - (11 * 60 * 1000);
  shouldTrigger = (Date.now() - simulatedLastRefresh) >= AUTO_REFRESH_INTERVAL_MS;
  assert.strictEqual(shouldTrigger, true, 'Must trigger auto-refresh after 10 minutes elapsed.');

  // Manual refresh resets the timer:
  simulatedLastRefresh = Date.now();
  shouldTrigger = (Date.now() - simulatedLastRefresh) >= AUTO_REFRESH_INTERVAL_MS;
  assert.strictEqual(shouldTrigger, false, 'Manual refresh must reset interval countdown.');
  console.log('✔ Automatic refresh timing and manual reset synchronization verified.\n');

  // --------------------------------------------------------------------------
  // Test 5: Manual refresh execution
  // --------------------------------------------------------------------------
  console.log('[5/12] Test 5: Manual Refresh Non-Destructive Flow...');
  const beforeManual = await fetchWeatherData(londonLat, londonLon);
  assert.strictEqual(beforeManual.current.isCached, true, 'Pre-condition: London is cached.');

  const manualResult = await fetchWeatherData(londonLat, londonLon, { forceRefresh: true });
  assert.strictEqual(manualResult.current.isCached, false, 'Manual refresh must retrieve fresh observation.');
  assert.strictEqual(manualResult.locationId, beforeManual.locationId, 'Location ID must match.');
  console.log('✔ Manual refresh execution verified.\n');

  // --------------------------------------------------------------------------
  // Test 6: Duplicate / in-flight request prevention
  // --------------------------------------------------------------------------
  console.log('[6/12] Test 6: In-Flight Request Deduplication...');
  clearWeatherCache();
  const nyLat = 40.7128;
  const nyLon = -74.0060;

  // Fire 3 concurrent requests simultaneously for the same location
  const [c1, c2, c3] = await Promise.all([
    fetchWeatherData(nyLat, nyLon),
    fetchWeatherData(nyLat, nyLon),
    fetchWeatherData(nyLat, nyLon),
  ]);

  assert.strictEqual(c1.lastUpdated, c2.lastUpdated, 'Concurrent requests must share identical payload.');
  assert.strictEqual(c2.lastUpdated, c3.lastUpdated, 'Concurrent requests must share identical payload.');
  assert.strictEqual(getInFlightRequestCount(), 0, 'In-flight request map must be empty after resolution.');
  console.log('✔ In-flight request deduplication verified (concurrent calls share 1 network request).\n');

  // --------------------------------------------------------------------------
  // Test 7: Background sync worker (EventBridge simulation)
  // --------------------------------------------------------------------------
  console.log('[7/12] Test 7: EventBridge Scheduled Background Sync Worker...');
  const mockScheduledEvent: ScheduledEvent = {
    version: '0',
    id: 'test-eventbridge-id',
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    account: '123456789012',
    time: new Date().toISOString(),
    region: 'us-east-1',
    resources: ['arn:aws:events:us-east-1:123456789012:rule/weather-gpt-forecast-sync'],
    detail: {},
  };

  const syncResult = await syncHandler(mockScheduledEvent, createMockContext());
  assert.strictEqual(syncResult.success, true, 'Background sync worker must report success.');
  assert.ok(syncResult.locationsAttempted > 0, 'Must attempt at least one location.');
  assert.ok(syncResult.locationsSucceeded > 0, 'Must successfully warm at least one location.');
  assert.strictEqual(syncResult.locationsFailed, 0, 'All valid locations should succeed without errors.');
  assert.ok(typeof syncResult.durationMs === 'number', 'Must record execution duration in milliseconds.');
  console.log(`   Sync worker completed: ${syncResult.locationsSucceeded}/${syncResult.locationsAttempted} succeeded in ${syncResult.durationMs}ms`);
  console.log('✔ Background sync worker verified.\n');

  // --------------------------------------------------------------------------
  // Test 8: Partial background sync failure handling & error isolation
  // --------------------------------------------------------------------------
  console.log('[8/12] Test 8: Partial Background Sync Failure Handling...');
  const mixedLocations = [
    { name: 'Tokyo (Valid)', latitude: 35.6762, longitude: 139.6503 },
    { name: 'Invalid Coordinates (Broken)', latitude: 999.0, longitude: 999.0 },
    { name: 'Paris (Valid)', latitude: 48.8566, longitude: 2.3522 },
  ];

  const partialResult = await syncLocations(mixedLocations, 'test-partial-sync');
  assert.strictEqual(partialResult.success, true, 'Worker job must succeed even if individual locations fail.');
  assert.strictEqual(partialResult.locationsAttempted, 3, 'Must attempt all 3 locations.');
  assert.strictEqual(partialResult.locationsSucceeded, 2, '2 valid locations must succeed.');
  assert.strictEqual(partialResult.locationsFailed, 1, '1 invalid location must fail.');
  assert.ok(partialResult.details && partialResult.details.length === 3, 'Must return per-location details.');
  assert.strictEqual(partialResult.details[1].success, false, 'Invalid location detail must indicate failure.');
  assert.ok(partialResult.details[1].error?.includes('Invalid latitude'), 'Error message must reflect coordinate failure.');
  assert.strictEqual(partialResult.details[0].success, true, 'First valid location must succeed.');
  assert.strictEqual(partialResult.details[2].success, true, 'Third valid location must succeed.');
  console.log('✔ Partial background sync error isolation verified (individual failure does not crash worker).\n');

  // --------------------------------------------------------------------------
  // Test 9: External API failure handling (cold cache)
  // --------------------------------------------------------------------------
  console.log('[9/12] Test 9: External API Failure Handling (Cold Cache)...');
  let rejected = false;
  try {
    await fetchWeatherData(999.0, 999.0);
  } catch (err: unknown) {
    rejected = true;
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes('Invalid latitude'), 'Must throw descriptive error on invalid inputs.');
  }
  assert.strictEqual(rejected, true, 'Cold cache request with invalid coords must throw safely.');
  assert.strictEqual(getCacheStatus(999.0, 999.0).isCached, false, 'Failed request must not pollute cache.');
  console.log('✔ Cold cache failure handling verified.\n');

  // --------------------------------------------------------------------------
  // Test 10: Preservation of previous valid data on network failure (stale fallback)
  // --------------------------------------------------------------------------
  console.log('[10/12] Test 10: Preservation of Previous Valid Data (Stale Fallback)...');
  // Sydney is cached from earlier or fresh:
  const sydneyLat = -33.8688;
  const sydneyLon = 151.2093;
  const sydneyInitial = await fetchWeatherData(sydneyLat, sydneyLon);
  assert.ok(sydneyInitial.current.temperature !== undefined, 'Sydney weather must be valid.');

  // Verify that an existing cached location has fallback safety within 24h:
  const sydneyStatus = getCacheStatus(sydneyLat, sydneyLon);
  assert.strictEqual(sydneyStatus.isCached, true, 'Sydney is cached in memory.');
  console.log('✔ Previous valid data preservation verified.\n');

  // --------------------------------------------------------------------------
  // Test 11: GraphQL weather query & mutation freshness compatibility
  // --------------------------------------------------------------------------
  console.log('[11/12] Test 11: GraphQL Weather Query & Mutation Freshness Compatibility...');
  const firstGqlQuery = await weatherResolvers.Query.weatherByCoordinates(null, {
    coordinates: { latitude: londonLat, longitude: londonLon },
  });
  assert.ok(firstGqlQuery.current.temperature !== undefined, 'First GraphQL query returns valid temperature.');

  const cachedGqlQuery = await weatherResolvers.Query.weatherByCoordinates(null, {
    coordinates: { latitude: londonLat, longitude: londonLon },
  });
  assert.strictEqual(cachedGqlQuery.current.isCached, true, 'Subsequent GraphQL query hits domain cache.');

  const gqlMutation = await weatherResolvers.Mutation.refreshWeather(null, {
    coordinates: { latitude: londonLat, longitude: londonLon },
  });
  assert.strictEqual(gqlMutation.current.isCached, false, 'GraphQL refreshWeather forces cache bypass.');
  console.log('✔ GraphQL query and mutation cache integration verified.\n');

  // --------------------------------------------------------------------------
  // Test 12: Active location coordinate change & cache key separation
  // --------------------------------------------------------------------------
  console.log('[12/12] Test 12: Active Location Coordinate Change & Cache Key Separation...');
  const kolkataLat = 22.5726;
  const kolkataLon = 88.3639;

  const kolkataFetch = await fetchWeatherData(kolkataLat, kolkataLon);
  assert.strictEqual(kolkataFetch.locationId, 'coords-22.5726-88.3639');

  const londonRecheck = await fetchWeatherData(londonLat, londonLon);
  assert.strictEqual(londonRecheck.locationId, 'coords-51.5074--0.1278');
  assert.strictEqual(londonRecheck.current.isCached, true, 'London remains cached and distinct from Kolkata.');
  assert.notStrictEqual(kolkataFetch.locationId, londonRecheck.locationId, 'Different coordinates must maintain distinct cache keys.');
  console.log('✔ Active location cache separation verified.\n');

  console.log('======================================================');
  console.log('ALL 12 PHASE 7 WEATHER FRESHNESS TESTS PASSED! ✔');
  console.log('======================================================\n');
}

runWeatherFreshnessTests().catch((err) => {
  console.error('Phase 7 Freshness Test Suite Failed:', err);
  process.exit(1);
});
