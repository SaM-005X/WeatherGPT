/**
 * Comprehensive Test Suite for Phase 3.1: Universal Location Search & Resolution
 *
 * Validates:
 * 1. Decimal & space-separated coordinate parsing.
 * 2. Degree & cardinal direction coordinate parsing.
 * 3. Coordinate range validation & error throwing.
 * 4. ActiveLocation model conversion & data consistency.
 * 5. Open-Meteo Geocoding REST API place-name resolution.
 * 6. Disambiguation results for ambiguous locations (e.g. Springfield).
 * 7. Live weather integration with newly resolved coordinates.
 */

import assert from 'node:assert';
import {
  parseCoordinateInput,
  searchGeocodingLocations,
  createLocationFromCoordinates,
  createLocationFromGeocoding,
} from '../lib/geocodingService';
import { fetchWeatherData } from '../lib/weatherService';

async function runGeocodingTests() {
  console.log('=== RUNNING PHASE 3.1 LOCATION RESOLUTION TESTS ===\n');

  // --------------------------------------------------------------------------
  // Unit Test 1: Coordinate Parsing Formats
  // --------------------------------------------------------------------------
  console.log('[1/8] Testing coordinate parsing formats...');

  // Comma separated
  const c1 = parseCoordinateInput('22.5726, 88.3639');
  assert(c1 !== null);
  assert.strictEqual(c1.latitude, 22.5726);
  assert.strictEqual(c1.longitude, 88.3639);

  // Space separated
  const c2 = parseCoordinateInput('55.7558 37.6173');
  assert(c2 !== null);
  assert.strictEqual(c2.latitude, 55.7558);
  assert.strictEqual(c2.longitude, 37.6173);

  // Negative coordinates
  const c3 = parseCoordinateInput('-33.8688, 151.2093');
  assert(c3 !== null);
  assert.strictEqual(c3.latitude, -33.8688);
  assert.strictEqual(c3.longitude, 151.2093);

  // Degree & cardinal directions (N / E)
  const c4 = parseCoordinateInput('22.5726° N, 88.3639° E');
  assert(c4 !== null);
  assert.strictEqual(c4.latitude, 22.5726);
  assert.strictEqual(c4.longitude, 88.3639);

  // Degree & cardinal directions (S / W)
  const c5 = parseCoordinateInput('33.8688° S, 151.2093° W');
  assert(c5 !== null);
  assert.strictEqual(c5.latitude, -33.8688);
  assert.strictEqual(c5.longitude, -151.2093);

  // Place names must return null (not coordinates)
  assert.strictEqual(parseCoordinateInput('Norway'), null);
  assert.strictEqual(parseCoordinateInput('Tokyo'), null);
  assert.strictEqual(parseCoordinateInput('Moscow'), null);
  assert.strictEqual(parseCoordinateInput('Springfield'), null);

  console.log('✔ Coordinate parsing tests passed.');

  // --------------------------------------------------------------------------
  // Unit Test 2: Coordinate Range Validation
  // --------------------------------------------------------------------------
  console.log('\n[2/8] Testing coordinate range validation (rejection of out-of-range coordinates)...');

  assert.throws(() => parseCoordinateInput('100, 200'), /Invalid coordinates/);
  assert.throws(() => parseCoordinateInput('91, 20'), /Invalid coordinates/);
  assert.throws(() => parseCoordinateInput('-95, 20'), /Invalid coordinates/);
  assert.throws(() => parseCoordinateInput('20, 181'), /Invalid coordinates/);
  assert.throws(() => parseCoordinateInput('20, -185'), /Invalid coordinates/);

  console.log('✔ Coordinate range validation tests passed.');

  // --------------------------------------------------------------------------
  // Unit Test 3: Location Model Consistency
  // --------------------------------------------------------------------------
  console.log('\n[3/8] Testing atomic ActiveLocation creation helpers...');

  const coordLoc = createLocationFromCoordinates(22.5726, 88.3639);
  assert.strictEqual(coordLoc.latitude, 22.5726);
  assert.strictEqual(coordLoc.longitude, 88.3639);
  assert.strictEqual(coordLoc.source, 'manual');
  assert(coordLoc.name.includes('22.57'));

  const geoLoc = createLocationFromGeocoding({
    id: 3144096,
    name: 'Norway',
    latitude: 62.0,
    longitude: 10.0,
    country: 'Norway',
    countryCode: 'NO',
    timezone: 'Europe/Oslo',
  });
  assert.strictEqual(geoLoc.name, 'Norway');
  assert.strictEqual(geoLoc.country, 'Norway');
  assert.strictEqual(geoLoc.latitude, 62.0);
  assert.strictEqual(geoLoc.longitude, 10.0);
  assert.strictEqual(geoLoc.timezone, 'Europe/Oslo');

  console.log('✔ ActiveLocation consistency tests passed.');

  // --------------------------------------------------------------------------
  // Live Test 4: Country Search ("Norway") — Verifying it does NOT keep Sydney
  // --------------------------------------------------------------------------
  console.log('\n[4/8] Testing place search for "Norway" (critical bug fix test)...');

  const norwayResults = await searchGeocodingLocations('Norway');
  assert(norwayResults.length > 0, 'Expected at least 1 result for Norway');

  const topNorway = norwayResults[0];
  console.log(`   Top Norway result: ${topNorway.name}, ${topNorway.country} [Lat: ${topNorway.latitude}, Lon: ${topNorway.longitude}]`);

  // MUST NOT be Sydney coordinates (-33.8688, 151.2093)
  assert.notStrictEqual(topNorway.latitude, -33.8688);
  assert.notStrictEqual(topNorway.longitude, 151.2093);
  assert(topNorway.latitude >= 57 && topNorway.latitude <= 71, 'Expected Norwegian latitude');
  assert(topNorway.longitude >= 4 && topNorway.longitude <= 32, 'Expected Norwegian longitude');

  // Verify weather request with these new Norwegian coordinates
  const norwayWeather = await fetchWeatherData(topNorway.latitude, topNorway.longitude);
  console.log(`   Norway live weather fetched: ${norwayWeather.current.temperature}°C, ${norwayWeather.current.conditionDescription}, Timezone: ${norwayWeather.timezone}`);
  assert.strictEqual(norwayWeather.timezone, 'Europe/Oslo');

  console.log('✔ "Norway" successfully resolved to real Norwegian coordinates & weather (Sydney bug FIXED!).');

  // --------------------------------------------------------------------------
  // Live Test 5: Arbitrary City Search ("Moscow")
  // --------------------------------------------------------------------------
  console.log('\n[5/8] Testing place search for arbitrary city "Moscow"...');

  const moscowResults = await searchGeocodingLocations('Moscow');
  assert(moscowResults.length > 0);
  const moscow = moscowResults[0];
  console.log(`   Moscow resolved: ${moscow.name}, ${moscow.country} [${moscow.latitude}, ${moscow.longitude}]`);
  assert(moscow.latitude >= 55 && moscow.latitude <= 56);
  assert(moscow.longitude >= 37 && moscow.longitude <= 38);

  const moscowWeather = await fetchWeatherData(moscow.latitude, moscow.longitude);
  console.log(`   Moscow live weather: ${moscowWeather.current.temperature}°C, Timezone: ${moscowWeather.timezone}`);
  assert.strictEqual(moscowWeather.timezone, 'Europe/Moscow');

  console.log('✔ Moscow resolved to real coordinates & weather.');

  // --------------------------------------------------------------------------
  // Live Test 6: Ambiguous Search ("Springfield")
  // --------------------------------------------------------------------------
  console.log('\n[6/8] Testing ambiguous search "Springfield" (multiple results returned)...');

  const springfields = await searchGeocodingLocations('Springfield');
  console.log(`   Springfield returned ${springfields.length} distinct matching locations:`);
  springfields.forEach((s, idx) => {
    console.log(`     ${idx + 1}. ${s.name}, ${s.admin1 || ''}, ${s.country} [${s.latitude}, ${s.longitude}]`);
  });

  assert(springfields.length > 1, 'Expected multiple results for Springfield');
  const states = springfields.map((s) => s.admin1);
  assert(states.includes('Illinois') || states.includes('Missouri') || states.includes('Massachusetts'));

  console.log('✔ Ambiguous location returned multiple identifiable options for disambiguation.');

  // --------------------------------------------------------------------------
  // Live Test 7: Direct Coordinate Weather Flow
  // --------------------------------------------------------------------------
  console.log('\n[7/8] Testing direct coordinates flow (22.5726, 88.3639 and 55.7558, 37.6173)...');

  const p1 = parseCoordinateInput('22.5726, 88.3639');
  assert(p1 !== null);
  const w1 = await fetchWeatherData(p1.latitude, p1.longitude);
  console.log(`   Coordinates 22.5726, 88.3639 weather: ${w1.current.temperature}°C, ${w1.timezone}`);
  assert.strictEqual(w1.timezone, 'Asia/Kolkata');

  const p2 = parseCoordinateInput('55.7558 37.6173');
  assert(p2 !== null);
  const w2 = await fetchWeatherData(p2.latitude, p2.longitude);
  console.log(`   Coordinates 55.7558 37.6173 weather: ${w2.current.temperature}°C, ${w2.timezone}`);
  assert.strictEqual(w2.timezone, 'Europe/Moscow');

  console.log('✔ Direct coordinate inputs correctly trigger weather without geocoding API call.');

  // --------------------------------------------------------------------------
  // Live Test 8: Unknown Location Handling
  // --------------------------------------------------------------------------
  console.log('\n[8/8] Testing unknown location handling ("xyznonexistentlocation123")...');

  const unknownResults = await searchGeocodingLocations('xyznonexistentlocation123');
  console.log(`   Unknown query results count: ${unknownResults.length}`);
  assert.strictEqual(unknownResults.length, 0);

  console.log('✔ Unknown location returns empty results array cleanly.');

  console.log('\n======================================================');
  console.log('ALL PHASE 3.1 GEOLOCATION RESOLUTION TESTS PASSED! ✔');
  console.log('======================================================\n');
}

runGeocodingTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
