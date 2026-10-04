/**
 * Stage 10 Test Suite: Environmental, Astronomical & Lifestyle Intelligence
 *
 * Validates:
 * 1. Air Quality service normalization, pollutant metric mapping, and EPA AQI categories.
 * 2. Sun & Moon astronomy solar arc ephemeris and synodic month lunar phase math.
 * 3. Activity suitability scoring algorithms across all 5 sports and extreme weather conditions.
 * 4. In-flight request deduplication and in-memory TTL caching across services.
 */

import assert from 'node:assert';
import {
  getUsAqiCategory,
  getHealthAdvisories,
  normalizeAirQualityData,
  fetchAirQuality,
  clearAirQualityCache,
  getAirQualityCacheKey,
  AIR_QUALITY_CACHE_TTL_MS,
} from '../lib/airQualityService';

import {
  SYNODIC_MONTH_DAYS,
  LUNAR_EPOCH_MS,
  calculateMoonIllumination,
  getMoonPhaseDetails,
  calculateLunarMetrics,
  calculateSolarArcProgress,
  normalizeAstronomyData,
  fetchAstronomyData,
  clearAstronomyCache,
  getAstronomyCacheKey,
  ASTRONOMY_CACHE_TTL_MS,
} from '../lib/astronomyService';

import {
  evaluateRunning,
  evaluateCycling,
  evaluateHiking,
  evaluateBeach,
  evaluateStargazing,
  evaluateAllActivities,
  getRatingTier,
  fetchActivitySuitability,
  clearActivityCache,
  getActivityCacheKey,
  ACTIVITY_CACHE_TTL_MS,
} from '../lib/activityService';

console.log('=== RUNNING STAGE 10 ENVIRONMENTAL, ASTRONOMY & ACTIVITY TESTS ===\n');

// ============================================================================
// 1. Air Quality Service Tests
// ============================================================================
console.log('[1/4] Testing Air Quality API Normalization & EPA AQI Thresholds...');

// Verify EPA category mapping
assert.strictEqual(getUsAqiCategory(0), 'Good');
assert.strictEqual(getUsAqiCategory(25), 'Good');
assert.strictEqual(getUsAqiCategory(50), 'Good');
assert.strictEqual(getUsAqiCategory(51), 'Moderate');
assert.strictEqual(getUsAqiCategory(100), 'Moderate');
assert.strictEqual(getUsAqiCategory(101), 'Sensitive');
assert.strictEqual(getUsAqiCategory(150), 'Sensitive');
assert.strictEqual(getUsAqiCategory(151), 'Unhealthy');
assert.strictEqual(getUsAqiCategory(200), 'Unhealthy');
assert.strictEqual(getUsAqiCategory(201), 'Hazardous');
assert.strictEqual(getUsAqiCategory(350), 'Hazardous');

// Verify health advisories
const goodAdvisory = getHealthAdvisories('Good');
assert.ok(goodAdvisory.general.includes('satisfactory'), 'Good advisory should indicate satisfactory air');

const hazardousAdvisory = getHealthAdvisories('Hazardous');
assert.ok(hazardousAdvisory.general.includes('emergency'), 'Hazardous advisory should indicate emergency conditions');

// Test data normalization
const mockRawAqi = {
  current: {
    us_aqi: 72,
    european_aqi: 35,
    pm2_5: 22.4,
    pm10: 45.1,
    carbon_monoxide: 450,
    nitrogen_dioxide: 28.5,
    sulphur_dioxide: 12.0,
    ozone: 55.4,
  },
};

const aqiReport = normalizeAirQualityData(22.5726, 88.3639, mockRawAqi);
assert.strictEqual(aqiReport.usAqi, 72);
assert.strictEqual(aqiReport.europeanAqi, 35);
assert.strictEqual(aqiReport.category, 'Moderate');
assert.strictEqual(aqiReport.pollutants.pm2_5.value, 22.4);
assert.strictEqual(aqiReport.pollutants.pm10.value, 45.1);
assert.strictEqual(aqiReport.pollutants.carbonMonoxide.value, 450);
assert.strictEqual(AIR_QUALITY_CACHE_TTL_MS, 300000, 'Air quality cache TTL must be 5 minutes');
assert.strictEqual(getAirQualityCacheKey(22.5, 88.3), 'air-quality-22.500-88.300');

console.log('✓ Air Quality service and EPA AQI mapping verified successfully.');

// ============================================================================
// 2. Astronomy Service Tests (Solar Arc & Lunar Synodic Math)
// ============================================================================
console.log('[2/4] Testing Sun & Moon Astronomy (Solar Arc & Lunar Synodic Math)...');

// Verify synodic month constants
assert.strictEqual(SYNODIC_MONTH_DAYS, 29.53058867);
assert.strictEqual(LUNAR_EPOCH_MS, Date.UTC(2000, 0, 6, 18, 14, 0));

// Test Moon Illumination formula
assert.strictEqual(calculateMoonIllumination(0), 0, 'New Moon illumination must be 0%');
assert.strictEqual(calculateMoonIllumination(0.5), 100, 'Full Moon illumination must be 100%');
assert.strictEqual(calculateMoonIllumination(0.25), 50, 'First Quarter illumination must be 50%');
assert.strictEqual(calculateMoonIllumination(0.75), 50, 'Last Quarter illumination must be 50%');

// Test Moon Phase Names
assert.strictEqual(getMoonPhaseDetails(0.0).name, 'New Moon');
assert.strictEqual(getMoonPhaseDetails(0.1).name, 'Waxing Crescent');
assert.strictEqual(getMoonPhaseDetails(0.25).name, 'First Quarter');
assert.strictEqual(getMoonPhaseDetails(0.4).name, 'Waxing Gibbous');
assert.strictEqual(getMoonPhaseDetails(0.5).name, 'Full Moon');
assert.strictEqual(getMoonPhaseDetails(0.6).name, 'Waning Gibbous');
assert.strictEqual(getMoonPhaseDetails(0.75).name, 'Last Quarter');
assert.strictEqual(getMoonPhaseDetails(0.9).name, 'Waning Crescent');

// Test Lunar Epoch Math on Known Date
// Jan 6, 2000, 18:14 UTC was a New Moon
const epochNewMoon = calculateLunarMetrics(new Date(LUNAR_EPOCH_MS));
assert.strictEqual(epochNewMoon.phaseName, 'New Moon');
assert.strictEqual(epochNewMoon.illuminationPercent, 0);

// ~14.765 days later was a Full Moon
const approxFullMoon = new Date(LUNAR_EPOCH_MS + 14.765294 * 24 * 60 * 60 * 1000);
const fullMoonMetrics = calculateLunarMetrics(approxFullMoon);
assert.strictEqual(fullMoonMetrics.phaseName, 'Full Moon');
assert.ok(fullMoonMetrics.illuminationPercent >= 98, 'Full Moon illumination should be >= 98%');

// Test Solar Arc Progress
const sunrise = '2026-10-04T06:00';
const sunset = '2026-10-04T18:00';

// Before sunrise: 0% progress, Pre-Dawn
const preDawn = new Date('2026-10-04T05:00');
const preDawnArc = calculateSolarArcProgress(sunrise, sunset, 43200, preDawn);
assert.strictEqual(preDawnArc.progressPercent, 0);
assert.strictEqual(preDawnArc.isSunUp, false);
assert.strictEqual(preDawnArc.solarStatus, 'Pre-Dawn');

// Midday (Solar Noon, 12:00): 50% progress, Daylight
const midday = new Date('2026-10-04T12:00');
const middayArc = calculateSolarArcProgress(sunrise, sunset, 43200, midday);
assert.strictEqual(middayArc.progressPercent, 50);
assert.strictEqual(middayArc.isSunUp, true);
assert.strictEqual(middayArc.solarStatus, 'Daylight');

// After sunset: 100% progress, Post-Dusk
const postDusk = new Date('2026-10-04T19:00');
const postDuskArc = calculateSolarArcProgress(sunrise, sunset, 43200, postDusk);
assert.strictEqual(postDuskArc.progressPercent, 100);
assert.strictEqual(postDuskArc.isSunUp, false);
assert.strictEqual(postDuskArc.solarStatus, 'Post-Dusk');

// Test normalization
const mockRawAstro = {
  daily: {
    sunrise: ['2026-10-04T06:15'],
    sunset: ['2026-10-04T18:15'],
    daylight_duration: [43200],
  },
};
const astroReport = normalizeAstronomyData(22.5726, 88.3639, mockRawAstro, midday);
assert.strictEqual(astroReport.solar.daylightDurationFormatted, '12h 0m');
assert.strictEqual(ASTRONOMY_CACHE_TTL_MS, 900000, 'Astronomy cache TTL must be 15 minutes');
assert.strictEqual(getAstronomyCacheKey(22.5, 88.3), 'astronomy-22.500-88.300');

console.log('✓ Astronomy solar arc and lunar calculations verified successfully.');

// ============================================================================
// 3. Activity Suitability Engine Tests (5 Activities & Edge Cases)
// ============================================================================
console.log('[3/4] Testing Activity Suitability Engine Across Edge Conditions...');

assert.strictEqual(getRatingTier(95), 'Ideal');
assert.strictEqual(getRatingTier(75), 'Good');
assert.strictEqual(getRatingTier(50), 'Fair');
assert.strictEqual(getRatingTier(20), 'Poor');

// Test 1: Ideal running conditions (16°C, dry, light wind)
const idealRun = evaluateRunning({
  tempC: 16,
  precipitationMm: 0,
  windSpeedKmh: 8,
  cloudCoverPercent: 20,
  humidityPercent: 55,
  isDaylight: true,
});
assert.strictEqual(idealRun.tier, 'Ideal');
assert.ok(idealRun.score >= 90, `Ideal run score should be >= 90, got ${idealRun.score}`);

// Test 2: Severe rain drops running and cycling scores
const rainStorm = evaluateAllActivities({
  tempC: 18,
  precipitationMm: 8.5, // Heavy rain
  windSpeedKmh: 20,
  cloudCoverPercent: 100,
  humidityPercent: 90,
  isDaylight: true,
});
assert.strictEqual(rainStorm.running.tier, 'Poor', 'Heavy rain should make running Poor');
assert.strictEqual(rainStorm.cycling.tier, 'Poor', 'Heavy rain should make cycling Poor');

// Test 3: Gale force wind impact on cycling (>50 km/h)
const galeWind = evaluateCycling({
  tempC: 20,
  precipitationMm: 0,
  windSpeedKmh: 55, // Gale gusts
  cloudCoverPercent: 10,
  humidityPercent: 40,
  isDaylight: true,
});
assert.strictEqual(galeWind.tier, 'Poor', 'Gale force winds should make cycling Poor');
assert.ok(galeWind.negativeDrivers.some((d) => d.includes('Gale force')), 'Should list gale wind negative driver');

// Test 3b: Hiking in daylight vs darkness
const idealHike = evaluateHiking({
  tempC: 18,
  precipitationMm: 0,
  windSpeedKmh: 10,
  cloudCoverPercent: 20,
  humidityPercent: 50,
  isDaylight: true,
});
assert.strictEqual(idealHike.tier, 'Ideal');

const nightHike = evaluateHiking({
  tempC: 18,
  precipitationMm: 0,
  windSpeedKmh: 10,
  cloudCoverPercent: 20,
  humidityPercent: 50,
  isDaylight: false,
});
assert.ok(nightHike.score < idealHike.score, 'Nighttime should reduce hiking safety score');
assert.ok(nightHike.negativeDrivers.some((d) => d.includes('darkness')), 'Should note darkness hazard');

// Test 4: Stargazing in Daylight vs. Night
const daylightStargazing = evaluateStargazing({
  tempC: 20,
  precipitationMm: 0,
  windSpeedKmh: 5,
  cloudCoverPercent: 0,
  humidityPercent: 40,
  isDaylight: true, // Sun is up!
});
assert.strictEqual(daylightStargazing.score, 0, 'Daylight stargazing must be 0');
assert.strictEqual(daylightStargazing.tier, 'Poor');
assert.ok(
  daylightStargazing.negativeDrivers.some((d) => d.includes('Daylight')),
  'Must include daylight refusal driver'
);

const pristineNightStargazing = evaluateStargazing({
  tempC: 15,
  precipitationMm: 0,
  windSpeedKmh: 5,
  cloudCoverPercent: 5, // Crystal clear
  humidityPercent: 50,
  isDaylight: false, // True night
});
assert.strictEqual(pristineNightStargazing.tier, 'Ideal');
assert.ok(pristineNightStargazing.score >= 95, 'Pristine night stargazing should be >= 95');

// Test 5: Overcast night stargazing (100% clouds)
const overcastNightStargazing = evaluateStargazing({
  tempC: 15,
  precipitationMm: 0,
  windSpeedKmh: 5,
  cloudCoverPercent: 100, // Total cloud cover
  humidityPercent: 60,
  isDaylight: false,
});
assert.strictEqual(overcastNightStargazing.tier, 'Poor', '100% cloud cover at night should make stargazing Poor');

// Test 6: Beach & Swimming (Warm & Sunny vs Cold & Night)
const idealBeach = evaluateBeach({
  tempC: 28,
  precipitationMm: 0,
  windSpeedKmh: 10,
  cloudCoverPercent: 10,
  humidityPercent: 55,
  isDaylight: true,
});
assert.strictEqual(idealBeach.tier, 'Ideal');

const coldNightBeach = evaluateBeach({
  tempC: 12, // Too cold
  precipitationMm: 0,
  windSpeedKmh: 10,
  cloudCoverPercent: 10,
  humidityPercent: 55,
  isDaylight: false, // Night
});
assert.strictEqual(coldNightBeach.tier, 'Poor');

assert.strictEqual(ACTIVITY_CACHE_TTL_MS, 300000, 'Activity cache TTL must be 5 minutes');
assert.strictEqual(getActivityCacheKey(22.5, 88.3), 'activity-22.500-88.300');

console.log('✓ Activity suitability engine algorithms and edge conditions verified successfully.');

// ============================================================================
// 4. In-Flight Request Deduplication & In-Memory TTL Caching
// ============================================================================
console.log('[4/4] Testing In-Flight Request Deduplication & Caching Across Services...');

async function testConcurrencyAndCaching() {
  clearAirQualityCache();
  clearAstronomyCache();
  clearActivityCache();

  let aqiFetchCount = 0;
  const mockAqiFetch = (async () => {
    aqiFetchCount++;
    // Simulate 30ms latency
    await new Promise((resolve) => setTimeout(resolve, 30));
    return {
      ok: true,
      status: 200,
      json: async () => mockRawAqi,
    } as unknown as Response;
  }) as typeof fetch;

  // Launch 4 concurrent requests for the exact same coordinate
  const [res1, res2, res3, res4] = await Promise.all([
    fetchAirQuality(22.5726, 88.3639, { fetchFn: mockAqiFetch }),
    fetchAirQuality(22.5726, 88.3639, { fetchFn: mockAqiFetch }),
    fetchAirQuality(22.5726, 88.3639, { fetchFn: mockAqiFetch }),
    fetchAirQuality(22.5726, 88.3639, { fetchFn: mockAqiFetch }),
  ]);

  assert.strictEqual(aqiFetchCount, 1, 'In-flight deduplication must collapse 4 requests into exactly 1 network call');
  assert.strictEqual(res1.usAqi, 72);
  assert.strictEqual(res2.usAqi, 72);
  assert.strictEqual(res3.usAqi, 72);
  assert.strictEqual(res4.usAqi, 72);

  // Subsequent call within TTL should hit cache directly (aqiFetchCount remains 1)
  const cachedCall = await fetchAirQuality(22.5726, 88.3639, { fetchFn: mockAqiFetch });
  assert.strictEqual(aqiFetchCount, 1, 'Cache hit must return stored report without invoking fetchFn');
  assert.strictEqual(cachedCall.isCached, true);

  // Astronomy caching test
  let astroFetchCount = 0;
  const mockAstroFetch = (async () => {
    astroFetchCount++;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return {
      ok: true,
      status: 200,
      json: async () => mockRawAstro,
    } as unknown as Response;
  }) as typeof fetch;

  const [astro1, astro2] = await Promise.all([
    fetchAstronomyData(22.5726, 88.3639, { fetchFn: mockAstroFetch }),
    fetchAstronomyData(22.5726, 88.3639, { fetchFn: mockAstroFetch }),
  ]);
  assert.strictEqual(astroFetchCount, 1, 'Astronomy fetch must collapse concurrent calls');
  assert.strictEqual(astro1.solar.sunriseTime, '06:15 AM');
  assert.strictEqual(astro2.solar.sunriseTime, '06:15 AM');

  // Activity fetch test with custom metrics (pure evaluation)
  const customReport = await fetchActivitySuitability(22.5726, 88.3639, {
    customMetrics: {
      tempC: 18,
      precipitationMm: 0,
      windSpeedKmh: 10,
      cloudCoverPercent: 15,
      humidityPercent: 50,
      isDaylight: true,
    },
  });
  assert.strictEqual(customReport.bestActivity.tier, 'Ideal');
  assert.ok(customReport.activityList.length === 5);
}

async function runStage10Tests() {
  await testConcurrencyAndCaching();

  console.log('✓ In-flight deduplication, cache hits, and concurrency verified successfully.\n');
  console.log('🎉 ALL STAGE 10 ENVIRONMENTAL, ASTRONOMICAL & ACTIVITY TESTS PASSED!\n');
}

runStage10Tests().catch((err) => {
  console.error('❌ STAGE 10 TEST FAILURE:', err);
  process.exit(1);
});
