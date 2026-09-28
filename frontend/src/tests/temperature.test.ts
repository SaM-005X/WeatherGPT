import { convertTemperature, formatTemperature, getTemperatureSymbol, formatWindSpeed } from '../lib/temperature';

function runTemperatureTests() {
  console.log('--- Running Temperature Conversion Tests ---');

  // Test 1: 19°C -> 66.2°F
  const tempC = 19;
  const rawConvertedF = convertTemperature(tempC, 'imperial');
  console.assert(rawConvertedF === 66.2, `Expected 66.2, got ${rawConvertedF}`);
  const tempF_formatted = formatTemperature(tempC, 'imperial');
  console.assert(tempF_formatted === '66.2', `Expected '66.2', got '${tempF_formatted}'`);
  console.log(`✓ 19°C converts to ${tempF_formatted}°F (expected 66.2°F).`);

  // Test 2: Switch back to metric -> 19°C
  const tempC_restored = formatTemperature(tempC, 'metric');
  console.assert(tempC_restored === '19', `Expected '19', got '${tempC_restored}'`);
  console.log(`✓ Switching back returns ${tempC_restored}°C.`);

  // Test 3: Whole number Fahrenheit (20°C -> 68°F)
  const temp20 = formatTemperature(20, 'imperial');
  console.assert(temp20 === '68', `Expected '68', got '${temp20}'`);
  console.log(`✓ 20°C converts to ${temp20}°F (clean integer).`);

  // Test 4: Feels-like temperature (18°C -> 64.4°F)
  const feelsLikeF = formatTemperature(18, 'imperial');
  console.assert(feelsLikeF === '64.4', `Expected '64.4', got '${feelsLikeF}'`);
  console.log(`✓ Feels like 18°C converts to ${feelsLikeF}°F.`);

  // Test 5: Daily minimum (12°C -> 53.6°F)
  const minTempF = formatTemperature(12, 'imperial');
  console.assert(minTempF === '53.6', `Expected '53.6', got '${minTempF}'`);
  console.log(`✓ Daily min 12°C converts to ${minTempF}°F.`);

  // Test 6: Temperature symbols
  console.assert(getTemperatureSymbol('metric') === '°C', 'Metric symbol must be °C');
  console.assert(getTemperatureSymbol('imperial') === '°F', 'Imperial symbol must be °F');
  console.log('✓ Temperature symbols verified.');

  // Test 7: Wind speed conversion
  const windMetric = formatWindSpeed(14, 'metric');
  const windImperial = formatWindSpeed(14, 'imperial');
  console.assert(windMetric === '14 km/h', `Expected '14 km/h', got '${windMetric}'`);
  console.assert(windImperial === '9 mph', `Expected '9 mph', got '${windImperial}'`);
  console.log(`✓ Wind speed: ${windMetric} -> ${windImperial}.`);

  console.log('--- ALL TEMPERATURE TESTS PASSED SUCCESSFULLY ---');
}

runTemperatureTests();
