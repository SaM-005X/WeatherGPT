/**
 * Phase 5 GraphQL Automated Test Suite
 *
 * Validates:
 * 1. Schema compilation and validity.
 * 2. Weather queries by coordinates (Celsius normalization, hourly, daily).
 * 3. Coordinate validation & GraphQL error reporting (BAD_USER_INPUT).
 * 4. Force refresh weather mutation.
 * 5. Location search query through geocoding service.
 * 6. Saved locations query through persistence service.
 * 7. Weather assistant architectural contract stub.
 */

import assert from 'node:assert';
import { graphql } from 'graphql';
import { schema } from '../graphql/schema';
import { WeatherReport } from '../types/weather';

async function runGraphQL(query: string, variables?: Record<string, unknown>) {
  return graphql({
    schema,
    source: query,
    variableValues: variables,
  });
}

async function runTests() {
  console.log('=== RUNNING PHASE 5 GRAPHQL FOUNDATION TESTS ===\n');

  // -------------------------------------------------------------------------
  // Test 1: Schema compilation and type existence
  // -------------------------------------------------------------------------
  console.log('[1/9] Testing GraphQL Schema compilation and type definition...');
  assert.ok(schema, 'Schema should be defined.');
  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  assert.ok(queryType, 'Query root type must exist.');
  assert.ok(mutationType, 'Mutation root type must exist.');
  assert.ok(queryType.getFields()['weatherByCoordinates'], 'Query.weatherByCoordinates must exist.');
  assert.ok(queryType.getFields()['searchLocations'], 'Query.searchLocations must exist.');
  assert.ok(queryType.getFields()['savedLocations'], 'Query.savedLocations must exist.');
  assert.ok(mutationType.getFields()['refreshWeather'], 'Mutation.refreshWeather must exist.');
  assert.ok(mutationType.getFields()['askWeatherAssistant'], 'Mutation.askWeatherAssistant must exist.');
  console.log('✔ Schema compilation and type validation passed.\n');

  // -------------------------------------------------------------------------
  // Test 2: Query weatherByCoordinates with valid coordinates (London)
  // -------------------------------------------------------------------------
  console.log('[2/9] Testing Query.weatherByCoordinates execution...');
  const weatherQuery = /* GraphQL */ `
    query GetWeather($coords: CoordinatesInput!) {
      weatherByCoordinates(coordinates: $coords) {
        locationId
        lastUpdated
        timezone
        current {
          temperature
          feelsLike
          humidity
          windSpeed
          weatherCode
          condition
          conditionDescription
          cloudCover
          recordedAt
        }
        hourly {
          time
          temperature
          precipitationProbability
          condition
        }
        daily {
          date
          temperatureMin
          temperatureMax
          precipitationProbability
          condition
        }
      }
    }
  `;

  const weatherRes = await runGraphQL(weatherQuery, {
    coords: { latitude: 51.5074, longitude: -0.1278 },
  });

  assert.strictEqual(weatherRes.errors, undefined, `GraphQL query should not have errors: ${JSON.stringify(weatherRes.errors)}`);
  assert.ok(weatherRes.data, 'Data must be returned.');
  const report = (weatherRes.data as unknown as { weatherByCoordinates: WeatherReport }).weatherByCoordinates;
  assert.ok(report, 'weatherByCoordinates payload must be present.');
  assert.ok(typeof report.current.temperature === 'number', 'Current temperature must be a number.');
  assert.ok(typeof report.current.feelsLike === 'number', 'Feels-like must be a number.');
  assert.ok(typeof report.current.humidity === 'number', 'Humidity must be a number.');
  assert.ok(report.current.cloudCover !== undefined, 'Cloud cover must be returned in GraphQL query.');
  assert.ok(report.current.condition, 'WeatherCondition must be defined.');
  assert.ok(Array.isArray(report.hourly) && report.hourly.length > 0, 'Hourly forecast array must not be empty.');
  assert.ok(Array.isArray(report.daily) && report.daily.length > 0, 'Daily forecast array must not be empty.');
  console.log(`   Fetched live weather for London: ${report.current.temperature}°C, ${report.current.condition}`);
  console.log('✔ Query.weatherByCoordinates passed.\n');

  // -------------------------------------------------------------------------
  // Test 3: Coordinate validation and BAD_USER_INPUT error handling
  // -------------------------------------------------------------------------
  console.log('[3/9] Testing coordinate bounds error handling (out of range)...');
  const invalidCoordsRes = await runGraphQL(weatherQuery, {
    coords: { latitude: 120.0, longitude: 250.0 }, // Out of range
  });

  assert.ok(invalidCoordsRes.errors && invalidCoordsRes.errors.length > 0, 'Invalid coordinates must produce GraphQL errors.');
  const firstError = invalidCoordsRes.errors[0];
  assert.strictEqual(firstError.extensions?.code, 'BAD_USER_INPUT', 'Error extension code must be BAD_USER_INPUT.');
  console.log(`   Received expected rejection: "${firstError.message}" [${firstError.extensions?.code}]`);
  console.log('✔ Coordinate range validation error handling passed.\n');

  // -------------------------------------------------------------------------
  // Test 4: Mutation refreshWeather (bypasses cache)
  // -------------------------------------------------------------------------
  console.log('[4/9] Testing Mutation.refreshWeather execution...');
  const refreshMutation = /* GraphQL */ `
    mutation Refresh($coords: CoordinatesInput!) {
      refreshWeather(coordinates: $coords) {
        locationId
        lastUpdated
        current {
          temperature
          isCached
          condition
        }
      }
    }
  `;

  const refreshRes = await runGraphQL(refreshMutation, {
    coords: { latitude: 51.5074, longitude: -0.1278 },
  });

  assert.strictEqual(refreshRes.errors, undefined, `Refresh mutation should not have errors: ${JSON.stringify(refreshRes.errors)}`);
  const refreshData = (refreshRes.data as unknown as { refreshWeather: WeatherReport }).refreshWeather;
  assert.ok(refreshData, 'refreshWeather payload must be present.');
  assert.strictEqual(refreshData.current.isCached, false, 'Force-refreshed weather must have isCached = false.');
  console.log(`   Force-refreshed observation: ${refreshData.current.temperature}°C (isCached: ${refreshData.current.isCached})`);
  console.log('✔ Mutation.refreshWeather passed.\n');

  // -------------------------------------------------------------------------
  // Test 5: Query searchLocations
  // -------------------------------------------------------------------------
  console.log('[5/9] Testing Query.searchLocations (geocoding resolver)...');
  const searchLocationsQuery = /* GraphQL */ `
    query Search($q: String!, $limit: Int) {
      searchLocations(query: $q, limit: $limit) {
        id
        name
        country
        latitude
        longitude
      }
    }
  `;

  const searchRes = await runGraphQL(searchLocationsQuery, {
    q: 'Tokyo',
    limit: 3,
  });

  assert.strictEqual(searchRes.errors, undefined, `Search query should not have errors: ${JSON.stringify(searchRes.errors)}`);
  const locations = (searchRes.data as unknown as { searchLocations: Array<{ id: string; name: string; country?: string; latitude: number; longitude: number }> }).searchLocations;
  assert.ok(Array.isArray(locations), 'Locations result must be an array.');
  assert.ok(locations.length > 0, 'Locations array should return results for "Tokyo".');
  const firstLoc = locations[0];
  assert.strictEqual(firstLoc.name, 'Tokyo', 'First location name should be Tokyo.');
  assert.ok(typeof firstLoc.latitude === 'number', 'Latitude must be numeric.');
  assert.ok(typeof firstLoc.longitude === 'number', 'Longitude must be numeric.');
  console.log(`   Resolved location: ${firstLoc.name}, ${firstLoc.country} [${firstLoc.latitude}, ${firstLoc.longitude}]`);

  // Test empty query validation
  const emptySearchRes = await runGraphQL(searchLocationsQuery, { q: '   ' });
  assert.ok(emptySearchRes.errors && emptySearchRes.errors.length > 0, 'Empty search must error.');
  assert.strictEqual(emptySearchRes.errors[0].extensions?.code, 'BAD_USER_INPUT');
  console.log('✔ Query.searchLocations passed.\n');

  // -------------------------------------------------------------------------
  // Test 6: Query savedLocations
  // -------------------------------------------------------------------------
  console.log('[6/9] Testing Query.savedLocations (persistence resolver)...');
  const savedLocationsQuery = /* GraphQL */ `
    query GetSavedLocations($limit: Int) {
      savedLocations(limit: $limit) {
        id
        name
        latitude
        longitude
        source
      }
    }
  `;

  const savedRes = await runGraphQL(savedLocationsQuery, { limit: 5 });
  assert.strictEqual(savedRes.errors, undefined, `Saved locations query should not have errors: ${JSON.stringify(savedRes.errors)}`);
  const savedList = (savedRes.data as unknown as { savedLocations: Array<{ id: string; name: string; latitude: number; longitude: number; source: string }> }).savedLocations;
  assert.ok(Array.isArray(savedList), 'Saved locations must return an array.');
  console.log(`   Retrieved ${savedList.length} saved locations from persistence resolver.`);
  console.log('✔ Query.savedLocations passed.\n');

  // -------------------------------------------------------------------------
  // Test 7: Mutation askWeatherAssistant (architectural stub)
  // -------------------------------------------------------------------------
  console.log('[7/9] Testing Mutation.askWeatherAssistant (contract stub)...');
  const assistantMutation = /* GraphQL */ `
    mutation AskAssistant($msg: String!) {
      askWeatherAssistant(message: $msg) {
        reply
        isOffTopic
      }
    }
  `;

  const assistantRes = await runGraphQL(assistantMutation, {
    msg: 'What is the temperature in London?',
  });

  assert.strictEqual(assistantRes.errors, undefined, `Assistant mutation should not have errors: ${JSON.stringify(assistantRes.errors)}`);
  const chatPayload = (assistantRes.data as unknown as { askWeatherAssistant: { reply: string; isOffTopic: boolean } }).askWeatherAssistant;
  assert.ok(chatPayload.reply.includes('[Preview]'), 'Preview contract reply should be returned.');
  assert.strictEqual(chatPayload.isOffTopic, false);

  // Test empty message validation
  const emptyMsgRes = await runGraphQL(assistantMutation, { msg: '' });
  assert.ok(emptyMsgRes.errors && emptyMsgRes.errors.length > 0, 'Empty message must error.');
  assert.strictEqual(emptyMsgRes.errors[0].extensions?.code, 'BAD_USER_INPUT');
  console.log('✔ Mutation.askWeatherAssistant passed.\n');

  // -------------------------------------------------------------------------
  // Test 8: Response parity between weatherService and GraphQL resolver
  // -------------------------------------------------------------------------
  console.log('[8/9] Testing response parity between weatherService and GraphQL resolver...');
  const { fetchWeatherData } = await import('../lib/weatherService');
  const directWeather = await fetchWeatherData(51.5074, -0.1278, { forceRefresh: false });
  const gqlWeatherRes = await runGraphQL(weatherQuery, {
    coords: { latitude: 51.5074, longitude: -0.1278 },
  });
  const gqlReport = (gqlWeatherRes.data as unknown as { weatherByCoordinates: WeatherReport }).weatherByCoordinates;

  assert.strictEqual(gqlReport.current.temperature, directWeather.current.temperature, 'Current temperatures must match.');
  assert.strictEqual(gqlReport.current.condition, directWeather.current.condition, 'Conditions must match.');
  assert.strictEqual(gqlReport.hourly.length, directWeather.hourly.length, 'Hourly counts must match.');
  assert.strictEqual(gqlReport.daily.length, directWeather.daily.length, 'Daily counts must match.');
  console.log(`   Parity confirmed: Direct=${directWeather.current.temperature}°C, GraphQL=${gqlReport.current.temperature}°C`);
  console.log('✔ Direct service vs. GraphQL response parity passed.\n');

  // -------------------------------------------------------------------------
  // Test 9: Testing fetchWeatherViaGraphQL adapter against live endpoint
  // -------------------------------------------------------------------------
  console.log('[9/9] Testing fetchWeatherViaGraphQL adapter execution...');
  const { fetchWeatherViaGraphQL } = await import('../graphql/client/weatherAdapter');
  const adapterReport = await fetchWeatherViaGraphQL(51.5074, -0.1278, {
    forceRefresh: false,
  });
  assert.ok(adapterReport, 'Adapter must return WeatherReport.');
  assert.ok(typeof adapterReport.current.temperature === 'number', 'Adapter temperature must be numeric.');
  assert.ok(adapterReport.hourly.length > 0, 'Adapter hourly forecast must be populated.');
  assert.ok(adapterReport.daily.length > 0, 'Adapter daily forecast must be populated.');
  console.log(`   Adapter received weather for London: ${adapterReport.current.temperature}°C, ${adapterReport.current.condition}`);
  console.log('✔ fetchWeatherViaGraphQL adapter passed.\n');

  console.log('======================================================');
  console.log('ALL 9 PHASE 5 GRAPHQL TESTS PASSED! ✔');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
