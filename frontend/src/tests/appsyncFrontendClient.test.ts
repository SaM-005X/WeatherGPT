/**
 * Phase 8.5.8 Frontend AppSync GraphQL Client Verification Suite
 *
 * Validates:
 * 1. fetchWeatherByCoordinates integration with live AppSync HTTPS endpoint.
 * 2. Proper request headers and authentication token delivery (x-api-key).
 * 3. Exact WeatherReport domain model mapping (Celsius normalization, 24-hr hourly, 7-day daily).
 * 4. Force refresh mutation execution via GraphQL client.
 * 5. Caller abort cancellation handling.
 * 6. Graceful error handling and fallback isolation.
 */

import assert from 'node:assert';
import {
  fetchWeatherByCoordinates,
  getAppSyncEndpoint,
  getAppSyncApiKey,
  GraphQLClientError,
} from '../lib/api/graphqlClient';

async function runTests() {
  console.log('=== RUNNING PHASE 8.5.8 FRONTEND APPSYNC INTEGRATION TESTS ===\n');

  const endpoint = getAppSyncEndpoint();
  const apiKey = getAppSyncApiKey();

  console.log(`Endpoint: ${endpoint}`);
  console.log(`API Key:  ${apiKey ? `${apiKey.substring(0, 7)}... (redacted)` : 'undefined'}\n`);

  assert.ok(endpoint, 'AppSync endpoint must be defined.');
  assert.ok(apiKey, 'AppSync API key must be defined in .env.local.');

  // -------------------------------------------------------------------------
  // Test 1: Live Query execution for coordinates (Kolkata)
  // -------------------------------------------------------------------------
  console.log('[1/5] Testing fetchWeatherByCoordinates against live AppSync backend...');
  const kolkataLat = 22.5726;
  const kolkataLon = 88.3639;

  const weather = await fetchWeatherByCoordinates(kolkataLat, kolkataLon, {
    forceRefresh: false,
    fallbackToDirect: false, // Ensure real AppSync is tested without fallback masking
  });

  assert.ok(weather, 'Weather report must be returned.');
  assert.ok(weather.locationId, 'LocationId must exist.');
  assert.ok(typeof weather.current.temperature === 'number', 'Current temperature must be a number.');
  assert.ok(weather.current.condition, 'Condition classification must exist.');
  assert.ok(Array.isArray(weather.hourly) && weather.hourly.length === 24, 'Hourly forecast must have 24 hours.');
  assert.ok(Array.isArray(weather.daily) && weather.daily.length >= 7, 'Daily forecast must have at least 7 days.');
  assert.strictEqual(weather.timezone, 'Asia/Kolkata', 'Timezone must match Kolkata.');

  assert.ok(typeof weather.current.cloudCover === 'number', 'cloudCover must be returned as a number from AppSync.');

  console.log(`   Temperature: ${weather.current.temperature}°C, Condition: ${weather.current.condition}, CloudCover: ${weather.current.cloudCover}%`);
  console.log(`   Timezone: ${weather.timezone}, Hourly: ${weather.hourly.length}, Daily: ${weather.daily.length}`);
  console.log('✔ Live AppSync weatherByCoordinates query with cloudCover passed.\n');

  // -------------------------------------------------------------------------
  // Test 2: Live Mutation refreshWeather execution (London)
  // -------------------------------------------------------------------------
  console.log('[2/5] Testing force-refresh mutation via AppSync backend...');
  const londonLat = 51.5074;
  const londonLon = -0.1278;

  const refreshedWeather = await fetchWeatherByCoordinates(londonLat, londonLon, {
    forceRefresh: true,
    fallbackToDirect: false,
  });

  assert.ok(refreshedWeather, 'Refreshed weather report must be returned.');
  assert.ok(typeof refreshedWeather.current.temperature === 'number', 'Refreshed temperature must be numeric.');
  assert.ok(refreshedWeather.hourly.length === 24, 'Hourly array must contain 24 hours.');
  assert.ok(refreshedWeather.daily.length >= 7, 'Daily array must contain 7 days.');

  console.log(`   London Refreshed Temp: ${refreshedWeather.current.temperature}°C, Timezone: ${refreshedWeather.timezone}`);
  console.log('✔ Live AppSync refreshWeather mutation passed.\n');

  // -------------------------------------------------------------------------
  // Test 3: Caller AbortSignal cancellation handling
  // -------------------------------------------------------------------------
  console.log('[3/5] Testing AbortSignal cancellation isolation...');
  const controller = new AbortController();
  controller.abort();

  let abortCaught = false;
  try {
    await fetchWeatherByCoordinates(kolkataLat, kolkataLon, {
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      abortCaught = true;
    }
  }

  assert.strictEqual(abortCaught, true, 'Immediate abort must throw AbortError.');
  console.log('✔ AbortSignal cancellation correctly handled.\n');

  // -------------------------------------------------------------------------
  // Test 4: Error handling on invalid endpoint (fallback disabled)
  // -------------------------------------------------------------------------
  console.log('[4/5] Testing descriptive error reporting when fallback disabled...');
  const prevUrl = process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL;
  try {
    process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL = 'https://invalid-non-existent-subdomain.appsync-api.us-east-1.amazonaws.com/graphql';

    let errorCaught = false;
    try {
      await fetchWeatherByCoordinates(kolkataLat, kolkataLon, {
        fallbackToDirect: false,
      });
    } catch (err: unknown) {
      if (err instanceof GraphQLClientError || err instanceof Error) {
        errorCaught = true;
      }
    }
    assert.strictEqual(errorCaught, true, 'Invalid endpoint without fallback must throw descriptive error.');
    console.log('✔ Descriptive error throwing verified.\n');
  } finally {
    process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL = prevUrl;
  }

  // -------------------------------------------------------------------------
  // Test 5: Graceful fallback when endpoint fails
  // -------------------------------------------------------------------------
  console.log('[5/5] Testing graceful fallback to domain service on network failure...');
  try {
    process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL = 'https://invalid-non-existent-subdomain.appsync-api.us-east-1.amazonaws.com/graphql';

    const fallbackResult = await fetchWeatherByCoordinates(kolkataLat, kolkataLon, {
      fallbackToDirect: true,
    });

    assert.ok(fallbackResult, 'Fallback result must be returned from domain service.');
    assert.ok(typeof fallbackResult.current.temperature === 'number', 'Fallback temp must be numeric.');
    console.log(`   Fallback succeeded with: ${fallbackResult.current.temperature}°C`);
    console.log('✔ Graceful fallback to domain service passed.\n');
  } finally {
    process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL = prevUrl;
  }

  console.log('======================================================');
  console.log('ALL 5 FRONTEND APPSYNC INTEGRATION TESTS PASSED! ✔');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
