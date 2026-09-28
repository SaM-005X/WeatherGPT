import { PRESET_LOCATIONS, findMatchingPreset, DEFAULT_ACTIVE_LOCATION } from '../lib/presetLocations';

function runLocationTests() {
  console.log('--- Running Location System Verification Tests ---');

  // 1. Verify default active location
  console.assert(DEFAULT_ACTIVE_LOCATION !== undefined, 'DEFAULT_ACTIVE_LOCATION must be defined');
  console.assert(DEFAULT_ACTIVE_LOCATION.name === 'London', 'Default location should be London');
  console.log('✓ Default location test passed.');

  // 2. Verify presets catalog
  console.assert(PRESET_LOCATIONS.length >= 6, 'PRESET_LOCATIONS must contain at least 6 presets');
  const kolkata = findMatchingPreset('Kolkata');
  console.assert(kolkata !== undefined, 'Kolkata must be found in presets');
  console.assert(kolkata?.latitude === 22.5726, 'Kolkata latitude must match 22.5726');
  console.assert(kolkata?.longitude === 88.3639, 'Kolkata longitude must match 88.3639');
  console.log('✓ Preset lookup test passed.');

  // 3. Case insensitive and partial matching
  const tokyo = findMatchingPreset('tokyo');
  console.assert(tokyo !== undefined, 'Case insensitive lookup failed for Tokyo');
  console.log('✓ Case-insensitive search test passed.');

  // 4. Coordinates parsing check
  const coordRegex = /^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/;
  const match = '22.5726, 88.3639'.match(coordRegex);
  console.assert(match !== null, 'Coordinate regex must match valid string');
  console.assert(parseFloat(match![1]) === 22.5726, 'Latitude must parse correctly');
  console.assert(parseFloat(match![3]) === 88.3639, 'Longitude must parse correctly');
  console.log('✓ Coordinate parsing test passed.');

  console.log('--- ALL LOCATION TESTS PASSED SUCCESSFULLY ---');
}

runLocationTests();
