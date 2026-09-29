/**
 * Deterministic Unit Tests for Weather Service & Normalization Layer
 *
 * Runs completely offline without depending on live network or external APIs.
 * Uses realistic fixture data representing Open-Meteo REST API responses.
 */

import assert from 'node:assert';
import {
  mapWmoCode,
} from '../lib/weatherCodes';
import {
  buildForecastUrl,
  validateCoordinates,
  normalizeCurrentWeather,
  normalizeHourlyForecast,
  normalizeDailyForecast,
  normalizeWeatherResponse,
  formatForecastDay,
  calculateObservationIso,
  getCacheKey,
  clearWeatherCache,
  OpenMeteoForecastResponse,
} from '../lib/weatherService';

console.log('--- STARTING WEATHER SERVICE DETERMINISTIC TESTS ---');

// ============================================================================
// 1. WMO Weather-Code Mapping Tests
// ============================================================================
console.log('\n[1/7] Testing WMO Weather Code Mapping...');

// Test Clear Sky (0, 1)
assert.strictEqual(mapWmoCode(0).condition, 'CLEAR');
assert.strictEqual(mapWmoCode(0).description, 'Clear sky');
assert.strictEqual(mapWmoCode(1).condition, 'CLEAR');
assert.strictEqual(mapWmoCode(1).description, 'Mainly clear');

// Test Partly Cloudy & Overcast (2, 3)
assert.strictEqual(mapWmoCode(2).condition, 'PARTLY_CLOUDY');
assert.strictEqual(mapWmoCode(3).condition, 'OVERCAST');

// Test Fog (45, 48)
assert.strictEqual(mapWmoCode(45).condition, 'FOG');
assert.strictEqual(mapWmoCode(48).condition, 'FOG');

// Test Drizzle (51, 53, 55, 56, 57)
assert.strictEqual(mapWmoCode(51).condition, 'DRIZZLE');
assert.strictEqual(mapWmoCode(55).condition, 'DRIZZLE');

// Test Rain & Heavy Rain (61, 63, 65, 80, 81, 82)
assert.strictEqual(mapWmoCode(61).condition, 'RAIN');
assert.strictEqual(mapWmoCode(65).condition, 'HEAVY_RAIN');
assert.strictEqual(mapWmoCode(82).condition, 'HEAVY_RAIN');

// Test Snow (71, 73, 75, 77, 85, 86)
assert.strictEqual(mapWmoCode(71).condition, 'SNOW');
assert.strictEqual(mapWmoCode(75).condition, 'SNOW');
assert.strictEqual(mapWmoCode(85).condition, 'SNOW');

// Test Thunderstorm (95, 96, 99)
assert.strictEqual(mapWmoCode(95).condition, 'THUNDERSTORM');
assert.strictEqual(mapWmoCode(99).condition, 'THUNDERSTORM');

// Test Unknown / Fallback codes
assert.strictEqual(mapWmoCode(999).condition, 'UNKNOWN');
assert.strictEqual(mapWmoCode(999).description, 'Unknown conditions');
assert.strictEqual(mapWmoCode(-5).condition, 'UNKNOWN');
assert.strictEqual(mapWmoCode(NaN).condition, 'UNKNOWN');

console.log('✔ WMO Weather Code Mapping passed.');

// ============================================================================
// 2. Coordinate-Based Request URL Construction Tests
// ============================================================================
console.log('\n[2/7] Testing Coordinate-Based Request Construction & Validation...');

// Valid Coordinates
const urlLondon = buildForecastUrl(51.5074, -0.1278);
assert(urlLondon.startsWith('https://api.open-meteo.com/v1/forecast'));
assert(urlLondon.includes('latitude=51.5074'));
assert(urlLondon.includes('longitude=-0.1278'));
assert(urlLondon.includes('timezone=auto'));
assert(urlLondon.includes('forecast_days=7'));
assert(urlLondon.includes('current=temperature_2m'));
assert(urlLondon.includes('cloud_cover'));
assert(urlLondon.includes('hourly=temperature_2m'));
assert(urlLondon.includes('daily=weather_code'));

const urlTokyo = buildForecastUrl(35.6762, 139.6503);
assert(urlTokyo.includes('latitude=35.6762'));
assert(urlTokyo.includes('longitude=139.6503'));

// Invalid Coordinates should throw
assert.throws(() => validateCoordinates(95, 0), /Invalid latitude/);
assert.throws(() => validateCoordinates(-95, 0), /Invalid latitude/);
assert.throws(() => validateCoordinates(0, 185), /Invalid longitude/);
assert.throws(() => validateCoordinates(0, -185), /Invalid longitude/);
assert.throws(() => validateCoordinates(NaN, 0), /valid numbers/);
assert.throws(() => buildForecastUrl(100, 200), /Invalid latitude/);

console.log('✔ Coordinate-Based Request Construction & Validation passed.');

// ============================================================================
// 3. Current Weather Normalization Tests
// ============================================================================
console.log('\n[3/7] Testing Current Weather Normalization...');

const mockCurrentRaw = {
  time: '2026-09-24T20:00',
  temperature_2m: 19.4,
  apparent_temperature: 18.2,
  relative_humidity_2m: 68.3,
  precipitation: 0.2,
  weather_code: 3,
  wind_speed_10m: 12.43,
  wind_direction_10m: 212,
  uv_index: 2.1,
};

const normalizedCurrent = normalizeCurrentWeather(mockCurrentRaw, 3600, false);

// Temperatures must be in Celsius without premature conversion
assert.strictEqual(normalizedCurrent.temperature, 19.4);
assert.strictEqual(normalizedCurrent.feelsLike, 18.2);
assert.strictEqual(normalizedCurrent.humidity, 68);
assert.strictEqual(normalizedCurrent.windSpeed, 12.4);
assert.strictEqual(normalizedCurrent.windDirection, 212);
assert.strictEqual(normalizedCurrent.weatherCode, 3);
assert.strictEqual(normalizedCurrent.condition, 'OVERCAST');
assert.strictEqual(normalizedCurrent.conditionDescription, 'Overcast');
assert.strictEqual(normalizedCurrent.precipitation, 0.2);
assert.strictEqual(normalizedCurrent.uvIndex, 2.1);
assert.strictEqual(normalizedCurrent.isCached, false);

// Observation ISO verification
const calculatedIso = calculateObservationIso('2026-09-24T20:00', 3600);
assert.strictEqual(calculatedIso, '2026-09-24T19:00:00.000Z');
assert.strictEqual(normalizedCurrent.recordedAt, '2026-09-24T19:00:00.000Z');
assert.strictEqual(normalizedCurrent.cloudCover, undefined); // optional when not present in raw

// Cloud Cover Normalization verification
const mockCurrentWithCloud = { ...mockCurrentRaw, cloud_cover: 75.4 };
const normalizedWithCloud = normalizeCurrentWeather(mockCurrentWithCloud, 3600, false);
assert.strictEqual(normalizedWithCloud.cloudCover, 75);

console.log('✔ Current Weather Normalization (including cloudCover) passed.');

// ============================================================================
// 4. Hourly Forecast Normalization Tests
// ============================================================================
console.log('\n[4/7] Testing Hourly Forecast Normalization (24-Hour Horizon)...');

const mockHourlyRaw = {
  time: Array.from({ length: 48 }, (_, i) => {
    const hour = (i % 24).toString().padStart(2, '0');
    const day = i < 24 ? '24' : '25';
    return `2026-09-${day}T${hour}:00`;
  }),
  temperature_2m: Array.from({ length: 48 }, (_, i) => 15 + (i % 10)),
  precipitation_probability: Array.from({ length: 48 }, (_, i) => (i * 2) % 100),
  weather_code: Array.from({ length: 48 }, () => 2),
};

// Start from 2026-09-24T20:00
const normalizedHourly = normalizeHourlyForecast(mockHourlyRaw, '2026-09-24T20:00');

// Must produce exactly 24 hours
assert.strictEqual(normalizedHourly.length, 24);
// First entry should be 20:00
assert.strictEqual(normalizedHourly[0].time, '20:00');
assert.strictEqual(normalizedHourly[0].temperature, 15 + (20 % 10));
assert.strictEqual(normalizedHourly[0].weatherCode, 2);
assert.strictEqual(normalizedHourly[0].condition, 'PARTLY_CLOUDY');
// Final entry should be 19:00 next day
assert.strictEqual(normalizedHourly[23].time, '19:00');

// Empty hourly handling
assert.deepStrictEqual(normalizeHourlyForecast({ time: [], temperature_2m: [], weather_code: [] }), []);

console.log('✔ Hourly Forecast Normalization passed.');

// ============================================================================
// 5. Daily Forecast Normalization Tests
// ============================================================================
console.log('\n[5/7] Testing Daily Forecast Normalization (7-Day Outlook)...');

const mockDailyRaw = {
  time: [
    '2026-09-24',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
    '2026-09-28',
    '2026-09-29',
    '2026-09-30',
  ],
  weather_code: [1, 2, 61, 3, 0, 71, 95],
  temperature_2m_max: [21.5, 23.0, 19.8, 20.1, 22.4, 18.0, 24.2],
  temperature_2m_min: [12.0, 13.5, 14.0, 11.2, 10.5, 9.0, 15.0],
  precipitation_probability_max: [10, 20, 75, 40, 5, 60, 85],
  sunrise: [
    '2026-09-24T06:45',
    '2026-09-25T06:47',
    '2026-09-26T06:48',
    '2026-09-27T06:50',
    '2026-09-28T06:51',
    '2026-09-29T06:53',
    '2026-09-30T06:54',
  ],
  sunset: [
    '2026-09-24T18:55',
    '2026-09-25T18:53',
    '2026-09-26T18:50',
    '2026-09-27T18:48',
    '2026-09-28T18:46',
    '2026-09-29T18:43',
    '2026-09-30T18:41',
  ],
};

const normalizedDaily = normalizeDailyForecast(mockDailyRaw);

assert.strictEqual(normalizedDaily.length, 7);

// Day 0 must be labeled 'Today'
assert.strictEqual(normalizedDaily[0].date, 'Today');
assert.strictEqual(normalizedDaily[0].temperatureMin, 12.0);
assert.strictEqual(normalizedDaily[0].temperatureMax, 21.5);
assert.strictEqual(normalizedDaily[0].precipitationProbability, 10);
assert.strictEqual(normalizedDaily[0].weatherCode, 1);
assert.strictEqual(normalizedDaily[0].condition, 'CLEAR');
assert.strictEqual(normalizedDaily[0].sunrise, '06:45');
assert.strictEqual(normalizedDaily[0].sunset, '18:55');

// Weekday formatting verification
assert.strictEqual(formatForecastDay('2026-09-24', 0), 'Today');
assert.strictEqual(typeof normalizedDaily[1].date, 'string');
assert.notStrictEqual(normalizedDaily[1].date, 'Today'); // Day 1 should be weekday name (e.g. Fri)

console.log('✔ Daily Forecast Normalization passed.');

// ============================================================================
// 6. Complete Response Normalization & Error Handling
// ============================================================================
console.log('\n[6/7] Testing Complete Response Normalization & Malformed Response Handling...');

const mockCompleteResponse: OpenMeteoForecastResponse = {
  latitude: 51.5074,
  longitude: -0.1278,
  utc_offset_seconds: 3600,
  timezone: 'Europe/London',
  current: mockCurrentRaw,
  hourly: mockHourlyRaw,
  daily: mockDailyRaw,
};

const fullReport = normalizeWeatherResponse(mockCompleteResponse, 'coords-51.5074--0.1278');
assert.strictEqual(fullReport.locationId, 'coords-51.5074--0.1278');
assert.strictEqual(fullReport.timezone, 'Europe/London');
assert.strictEqual(fullReport.current.temperature, 19.4);
assert.strictEqual(fullReport.hourly.length, 24);
assert.strictEqual(fullReport.daily.length, 7);
assert(typeof fullReport.lastUpdated === 'string');

// Malformed handling
assert.throws(
  () => normalizeWeatherResponse(null as unknown as OpenMeteoForecastResponse, 'test'),
  /Malformed weather response/
);
assert.throws(
  () => normalizeWeatherResponse({} as unknown as OpenMeteoForecastResponse, 'test'),
  /Malformed weather response/
);

console.log('✔ Complete Response Normalization & Malformed Response Handling passed.');

// ============================================================================
// 7. Client Cache Deterministic Logic Tests
// ============================================================================
console.log('\n[7/7] Testing Client Cache Keying & Operations...');

clearWeatherCache();
const key1 = getCacheKey(22.57264, 88.36389);
const key2 = getCacheKey(22.57261, 88.36391);
// Points rounded to 4 decimals (approx 11m precision) should produce identical cache key
assert.strictEqual(key1, key2);
assert.strictEqual(key1, '22.5726,88.3639');

// Distant coordinates must produce different cache keys
const keyTokyo = getCacheKey(35.6762, 139.6503);
assert.notStrictEqual(key1, keyTokyo);

console.log('✔ Client Cache Logic passed.');

console.log('\n======================================================');
console.log('ALL 7 DETERMINISTIC WEATHER SERVICE TESTS PASSED! ✔');
console.log('======================================================\n');
