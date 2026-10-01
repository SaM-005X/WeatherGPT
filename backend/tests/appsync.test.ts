/**
 * Phase 8.5.4 AppSync Lambda Resolver Unit Tests
 *
 * Validates backend/src/handlers/appsync.ts for:
 * 1. Valid Query.weatherByCoordinates execution
 * 2. Invalid latitude rejection
 * 3. Invalid longitude rejection
 * 4. Non-numeric coordinate input rejection
 * 5. Unsupported resolver field rejection
 * 6. Weather service failure handling (no silent fake data)
 * 7. Parent type validation (Query accepted, non-Query rejected)
 *
 * MOCKING POLICY:
 * Completely offline — mocks the domain weather service at the module boundary.
 * Global fetch is guarded to ensure no real Open-Meteo network calls occur.
 */

import assert from 'node:assert';
import type { AppSyncResolverEvent, Context } from 'aws-lambda';
import { handler, WeatherByCoordinatesArguments, WeatherReport } from '../src/handlers/appsync';

function createMockContext(awsRequestId = 'test-appsync-req-1'): Context {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'weather-gpt-appsync',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:weather-gpt-appsync',
    memoryLimitInMB: '512',
    awsRequestId,
    logGroupName: '/aws/lambda/weather-gpt-appsync',
    logStreamName: '2026/09/30/[$LATEST]appsync-stream',
    getRemainingTimeInMillis: () => 10000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };
}

function createMockAppSyncEvent(options: {
  parentTypeName?: string;
  fieldName?: string;
  coordinates?: { latitude: unknown; longitude: unknown };
}): AppSyncResolverEvent<WeatherByCoordinatesArguments> {
  const {
    parentTypeName = 'Query',
    fieldName = 'weatherByCoordinates',
    coordinates = { latitude: 51.5074, longitude: -0.1278 },
  } = options;

  return {
    arguments: {
      coordinates: coordinates as unknown as { latitude: number; longitude: number },
    },
    identity: null,
    source: null,
    request: {
      headers: {
        'x-api-key': 'da2-mockapikey123456',
      },
      domainName: null,
    },
    info: {
      selectionSetList: ['locationId', 'lastUpdated', 'current/temperature'],
      selectionSetGraphQL: '{ locationId lastUpdated current { temperature } }',
      parentTypeName,
      fieldName,
      variables: {},
    },
    prev: null,
    stash: {},
  };
}

const mockWeatherReportFixture: WeatherReport = {
  locationId: 'coords-51.5074--0.1278',
  current: {
    temperature: 18.5,
    feelsLike: 18.0,
    humidity: 65,
    windSpeed: 12.3,
    windDirection: 210,
    weatherCode: 2,
    condition: 'PARTLY_CLOUDY',
    conditionDescription: 'Partly cloudy',
    precipitation: 0,
    uvIndex: 4.2,
    recordedAt: '2026-09-30T00:00:00.000Z',
    isCached: false,
  },
  hourly: [
    {
      time: '12:00',
      temperature: 18.5,
      precipitationProbability: 10,
      weatherCode: 2,
      condition: 'PARTLY_CLOUDY',
    },
  ],
  daily: [
    {
      date: 'Today',
      temperatureMin: 12.0,
      temperatureMax: 19.5,
      precipitationProbability: 20,
      weatherCode: 2,
      condition: 'PARTLY_CLOUDY',
    },
  ],
  lastUpdated: '2026-09-30T00:00:00.000Z',
  timezone: 'Europe/London',
};

async function runUnitTests() {
  console.log('=== RUNNING PHASE 8.5.4 APPSYNC LAMBDA RESOLVER UNIT TESTS ===\n');

  // Guard against any accidental live network calls
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('CRITICAL TEST FAILURE: Live network fetch invoked during unit tests! Tests must run offline.');
  };

  let serviceCalls: Array<{ lat: number; lon: number; options?: { forceRefresh?: boolean } }> = [];

  try {
    // -------------------------------------------------------------------------
    // Test 1: Valid Query.weatherByCoordinates with valid coordinates
    // -------------------------------------------------------------------------
    console.log('[1/7] Testing valid Query.weatherByCoordinates resolution...');
    serviceCalls = [];

    // Mock weatherService at module boundary
    const mockFetch = async (
      lat: number,
      lon: number,
      options?: { forceRefresh?: boolean }
    ) => {
      serviceCalls.push({ lat, lon, options });
      return mockWeatherReportFixture;
    };

    const validEvent = createMockAppSyncEvent({
      coordinates: { latitude: 51.5074, longitude: -0.1278 },
    });
    const context = createMockContext();

    const result = await handler(validEvent, context, { fetchWeatherData: mockFetch });

    assert.strictEqual(serviceCalls.length, 1, 'Domain service must be called exactly once.');
    assert.strictEqual(serviceCalls[0].lat, 51.5074, 'Latitude must be passed correctly to domain service.');
    assert.strictEqual(serviceCalls[0].lon, -0.1278, 'Longitude must be passed correctly to domain service.');
    assert.strictEqual(serviceCalls[0].options?.forceRefresh, false, 'forceRefresh must be false for normal query.');

    assert.strictEqual(result.locationId, 'coords-51.5074--0.1278', 'Location ID must match fixture.');
    assert.strictEqual(result.current.temperature, 18.5, 'Current temperature must match fixture.');
    assert.strictEqual(result.current.condition, 'PARTLY_CLOUDY', 'Condition must match fixture.');
    assert.strictEqual(result.timezone, 'Europe/London', 'Timezone must match fixture.');
    console.log(`   Resolved location: ${result.locationId}, Temp: ${result.current.temperature}°C, Condition: ${result.current.condition}`);
    console.log('✔ Test 1 passed: Valid Query.weatherByCoordinates correctly dispatches to domain service.\n');

    // -------------------------------------------------------------------------
    // Test 2: Invalid latitude rejection
    // -------------------------------------------------------------------------
    console.log('[2/7] Testing invalid latitude rejection (-95 and 95)...');
    serviceCalls = [];

    const invalidLatEventLow = createMockAppSyncEvent({
      coordinates: { latitude: -95, longitude: 0 },
    });
    await assert.rejects(
      async () => handler(invalidLatEventLow, context),
      /Invalid latitude \(-95\)/,
      'Handler must reject latitude < -90'
    );

    const invalidLatEventHigh = createMockAppSyncEvent({
      coordinates: { latitude: 95, longitude: 0 },
    });
    await assert.rejects(
      async () => handler(invalidLatEventHigh, context),
      /Invalid latitude \(95\)/,
      'Handler must reject latitude > 90'
    );

    assert.strictEqual(serviceCalls.length, 0, 'Domain service must NOT be called for invalid latitude.');
    console.log('✔ Test 2 passed: Invalid latitude correctly rejected with validation error.\n');

    // -------------------------------------------------------------------------
    // Test 3: Invalid longitude rejection
    // -------------------------------------------------------------------------
    console.log('[3/7] Testing invalid longitude rejection (-185 and 185)...');
    serviceCalls = [];

    const invalidLonEventLow = createMockAppSyncEvent({
      coordinates: { latitude: 0, longitude: -185 },
    });
    await assert.rejects(
      async () => handler(invalidLonEventLow, context),
      /Invalid longitude \(-185\)/,
      'Handler must reject longitude < -180'
    );

    const invalidLonEventHigh = createMockAppSyncEvent({
      coordinates: { latitude: 0, longitude: 185 },
    });
    await assert.rejects(
      async () => handler(invalidLonEventHigh, context),
      /Invalid longitude \(185\)/,
      'Handler must reject longitude > 180'
    );

    assert.strictEqual(serviceCalls.length, 0, 'Domain service must NOT be called for invalid longitude.');
    console.log('✔ Test 3 passed: Invalid longitude correctly rejected with validation error.\n');

    // -------------------------------------------------------------------------
    // Test 4: Non-numeric coordinate input rejection
    // -------------------------------------------------------------------------
    console.log('[4/7] Testing non-numeric coordinate input rejection...');
    serviceCalls = [];

    const nonNumericLatEvent = createMockAppSyncEvent({
      coordinates: { latitude: '51.5074' as unknown as number, longitude: -0.1278 },
    });
    await assert.rejects(
      async () => handler(nonNumericLatEvent, context),
      /Invalid coordinates: Latitude and longitude must be valid numbers\./,
      'Handler must reject string latitude'
    );

    const nanLonEvent = createMockAppSyncEvent({
      coordinates: { latitude: 51.5074, longitude: Number.NaN },
    });
    await assert.rejects(
      async () => handler(nanLonEvent, context),
      /Invalid coordinates: Latitude and longitude must be valid numbers\./,
      'Handler must reject NaN longitude'
    );

    assert.strictEqual(serviceCalls.length, 0, 'Domain service must NOT be called for non-numeric input.');
    console.log('✔ Test 4 passed: Non-numeric coordinates rejected without invoking service.\n');

    // -------------------------------------------------------------------------
    // Test 5: Unsupported resolver field rejection
    // -------------------------------------------------------------------------
    console.log('[5/7] Testing unsupported resolver fields rejection...');
    serviceCalls = [];

    const unsupportedFields = ['searchLocations', 'savedLocations', 'refreshWeather', 'askWeatherAssistant', 'unknownField'];

    for (const field of unsupportedFields) {
      const unsupportedEvent = createMockAppSyncEvent({
        fieldName: field,
      });
      await assert.rejects(
        async () => handler(unsupportedEvent, context),
        new RegExp(`Unsupported resolver field: "${field}"\\. Only "weatherByCoordinates" is currently supported\\.`),
        `Handler must reject unsupported field: ${field}`
      );
    }

    assert.strictEqual(serviceCalls.length, 0, 'Domain service must NOT be called for unsupported fields.');
    console.log('✔ Test 5 passed: All unsupported resolver fields rejected clearly.\n');

    // -------------------------------------------------------------------------
    // Test 6: Weather service failure handling (no fake data)
    // -------------------------------------------------------------------------
    console.log('[6/7] Testing upstream domain service failure propagation...');
    serviceCalls = [];

    const mockFailingFetch = async () => {
      throw new Error('Weather network request timed out after 15 seconds.');
    };

    const failingEvent = createMockAppSyncEvent({
      coordinates: { latitude: 51.5074, longitude: -0.1278 },
    });

    await assert.rejects(
      async () => handler(failingEvent, context, { fetchWeatherData: mockFailingFetch }),
      /Weather network request timed out after 15 seconds\./,
      'Handler must propagate upstream error without returning fake weather'
    );

    console.log('✔ Test 6 passed: Upstream failure surfaced cleanly without silent swallowing or fake data.\n');

    // -------------------------------------------------------------------------
    // Test 7: Correct parent type validation
    // -------------------------------------------------------------------------
    console.log('[7/7] Testing parent type validation...');
    serviceCalls = [];

    // Re-enable success mock
    const mockSuccessFetch = async () => {
      serviceCalls.push({ lat: 0, lon: 0 });
      return mockWeatherReportFixture;
    };

    // Query parent type accepted
    const queryEvent = createMockAppSyncEvent({
      parentTypeName: 'Query',
    });
    const queryResult = await handler(queryEvent, context, { fetchWeatherData: mockSuccessFetch });
    assert.ok(queryResult.current, 'Query parent type must be accepted.');

    // Mutation parent type rejected
    const mutationEvent = createMockAppSyncEvent({
      parentTypeName: 'Mutation',
    });
    await assert.rejects(
      async () => handler(mutationEvent, context),
      /Unsupported parent type: "Mutation"\. Only "Query" is supported\./,
      'Mutation parent type must be rejected'
    );

    // Subscription parent type rejected
    const subscriptionEvent = createMockAppSyncEvent({
      parentTypeName: 'Subscription',
    });
    await assert.rejects(
      async () => handler(subscriptionEvent, context),
      /Unsupported parent type: "Subscription"\. Only "Query" is supported\./,
      'Subscription parent type must be rejected'
    );

    console.log('✔ Test 7 passed: Only "Query" parentTypeName is accepted; Mutation/Subscription rejected.\n');

    console.log('======================================================');
    console.log('ALL 7 APPSYNC RESOLVER UNIT TESTS PASSED! ✔');
    console.log('======================================================');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runUnitTests().catch((err) => {
  console.error('AppSync unit tests failed:', err);
  process.exit(1);
});
