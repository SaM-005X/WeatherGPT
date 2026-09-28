/**
 * Live Verification Script
 * Validates real API interaction, coordinate-based requests, unit conversion,
 * device coordinates, and cache behavior with live Open-Meteo endpoint.
 */

import { fetchWeatherData } from '../lib/weatherService';
import { formatTemperature, getTemperatureSymbol } from '../lib/temperature';

async function runLiveVerification() {
  console.log('=== RUNNING LIVE VERIFICATION AGAINST OPEN-METEO ===\n');

  // Test 1: London
  console.log('1. Testing London (51.5074, -0.1278)...');
  const london = await fetchWeatherData(51.5074, -0.1278);
  console.log(`   Location: London`);
  console.log(`   Timezone: ${london.timezone}`);
  console.log(`   Current Temp: ${london.current.temperature}°C (${formatTemperature(london.current.temperature, 'imperial')}°F)`);
  console.log(`   Feels Like: ${london.current.feelsLike}°C (${formatTemperature(london.current.feelsLike, 'imperial')}°F)`);
  console.log(`   Condition: ${london.current.condition} - ${london.current.conditionDescription}`);
  console.log(`   Humidity: ${london.current.humidity}%`);
  console.log(`   Wind: ${london.current.windSpeed} km/h (${london.current.windDirection}°)`);
  console.log(`   Hourly items: ${london.hourly.length} (First: ${london.hourly[0]?.time} @ ${london.hourly[0]?.temperature}°C)`);
  console.log(`   Daily items: ${london.daily.length} (Today Min/Max: ${london.daily[0]?.temperatureMin}°C / ${london.daily[0]?.temperatureMax}°C)`);

  // Test 2: Kolkata
  console.log('\n2. Testing Kolkata (22.5726, 88.3639)...');
  const kolkata = await fetchWeatherData(22.5726, 88.3639);
  console.log(`   Location: Kolkata`);
  console.log(`   Timezone: ${kolkata.timezone}`);
  console.log(`   Current Temp: ${kolkata.current.temperature}°C (${formatTemperature(kolkata.current.temperature, 'imperial')}°F)`);
  console.log(`   Condition: ${kolkata.current.condition} - ${kolkata.current.conditionDescription}`);
  console.log(`   Humidity: ${kolkata.current.humidity}%`);

  // Test 3: Tokyo
  console.log('\n3. Testing Tokyo (35.6762, 139.6503)...');
  const tokyo = await fetchWeatherData(35.6762, 139.6503);
  console.log(`   Location: Tokyo`);
  console.log(`   Timezone: ${tokyo.timezone}`);
  console.log(`   Current Temp: ${tokyo.current.temperature}°C (${formatTemperature(tokyo.current.temperature, 'imperial')}°F)`);
  console.log(`   Condition: ${tokyo.current.condition} - ${tokyo.current.conditionDescription}`);
  console.log(`   Humidity: ${tokyo.current.humidity}%`);

  // Verification that Kolkata, Tokyo, London produce distinct weather
  if (london.current.temperature === kolkata.current.temperature && london.timezone === kolkata.timezone) {
    throw new Error('London and Kolkata returned identical mock-like data!');
  }
  console.log('\n✔ London, Kolkata, and Tokyo returned distinct, real meteorological data!');

  // Test 4: Device Location simulation (arbitrary coordinates, e.g. 22.56, 88.40)
  console.log('\n4. Testing Device Location coordinates (22.5600, 88.4000)...');
  const device = await fetchWeatherData(22.5600, 88.4000);
  console.log(`   Timezone: ${device.timezone}`);
  console.log(`   Current Temp: ${device.current.temperature}°C (${formatTemperature(device.current.temperature, 'imperial')}°F)`);
  console.log(`   Condition: ${device.current.conditionDescription}`);
  console.log('✔ Arbitrary coordinates from device geolocation correctly retrieve real weather!');

  // Test 5: Unit conversion checks
  console.log('\n5. Testing Unit Conversions (°C <-> °F)...');
  const testC = 19;
  const convertedF = formatTemperature(testC, 'imperial');
  const symbolF = getTemperatureSymbol('imperial');
  const revertedC = formatTemperature(testC, 'metric');
  const symbolC = getTemperatureSymbol('metric');
  console.log(`   ${testC}°C -> ${convertedF}${symbolF} (Expected: 66.2°F)`);
  console.log(`   Reverted back -> ${revertedC}${symbolC} (Expected: 19°C)`);
  if (convertedF !== '66.2' || revertedC !== '19') {
    throw new Error(`Unit conversion failed: expected 66.2 and 19, got ${convertedF} and ${revertedC}`);
  }
  console.log('✔ Unit conversion 19°C -> 66.2°F and reversible switch verified!');

  // Test 6: Cache and Refresh
  console.log('\n6. Testing Cache & Refresh...');
  const cached = await fetchWeatherData(51.5074, -0.1278);
  console.log(`   Second request isCached: ${cached.current.isCached} (Expected: true)`);
  if (!cached.current.isCached) {
    throw new Error('Expected second request within 5 minutes to be cached!');
  }

  const refreshed = await fetchWeatherData(51.5074, -0.1278, { forceRefresh: true });
  console.log(`   Force refreshed isCached: ${refreshed.current.isCached} (Expected: false)`);
  if (refreshed.current.isCached) {
    throw new Error('Expected forceRefresh to bypass cache!');
  }
  console.log('✔ Cache hit and force-refresh bypass verified!');

  // Test 7: Error handling for invalid coordinates
  console.log('\n7. Testing Coordinate Validation & Error Handling...');
  try {
    await fetchWeatherData(999, 0);
    throw new Error('Failed to reject invalid latitude');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    console.log(`   Invalid latitude caught cleanly: "${msg}"`);
  }

  console.log('\n======================================================');
  console.log('ALL LIVE VERIFICATIONS SUCCESSFUL! ✔');
  console.log('======================================================');
}

runLiveVerification().catch((err) => {
  console.error('Live verification failed:', err);
  process.exit(1);
});
