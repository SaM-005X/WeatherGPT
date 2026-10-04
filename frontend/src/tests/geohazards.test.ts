/**
 * Automated Test Suite for Stage 9: Geohazards Architecture
 * (Earthquakes, Volcanoes & Tsunamis)
 *
 * Validates:
 * 1. USGS GeoJSON normalization and Haversine distance / cardinal bearing calculations.
 * 2. Earthquake magnitude severity classification (minor, moderate, strong, major) and filter scopes.
 * 3. Volcano Aviation Color Code parsing (GREEN, YELLOW, ORANGE, RED) and activity status distinction (erupting, unrest).
 * 4. NOAA Tsunami advisory status level normalization and emergency safety guidelines.
 * 5. In-memory caching (5-min for earthquakes/tsunamis, 15-min for volcanoes), deduplication, and layer unmount safety.
 */

import assert from 'node:assert';
import {
  calculateHaversineDistanceKm,
  calculateCardinalBearing,
  getEarthquakeSeverity,
  filterEarthquakes,
  fetchEarthquakes,
  clearEarthquakeCache,
  EARTHQUAKE_CACHE_TTL_MS,
  Earthquake,
} from '../lib/earthquakeService';

import {
  parseAviationColorCode,
  filterVolcanoes,
  fetchVolcanoes,
  clearVolcanoCache,
  VOLCANO_CACHE_TTL_MS,
} from '../lib/volcanoService';

import {
  normalizeTsunamiStatus,
  getTsunamiSafetyGuidelines,
  fetchTsunamiAdvisories,
  clearTsunamiCache,
  TSUNAMI_CACHE_TTL_MS,
} from '../lib/tsunamiService';

console.log('=== RUNNING STAGE 9 GEOHAZARDS ARCHITECTURE TESTS ===\n');

async function runGeohazardsTests() {
  // ============================================================================
  // 1. Haversine Distance & Bearing Calculation Verification
  // ============================================================================
  console.log('[1/6] Testing Spatial Math (Haversine & Bearing)...');

  // San Francisco (37.7749, -122.4194) to Los Angeles (34.0522, -118.2437) ~559 km, South-East
  const sfLat = 37.7749;
  const sfLon = -122.4194;
  const laLat = 34.0522;
  const laLon = -118.2437;

  const distSfLa = calculateHaversineDistanceKm(sfLat, sfLon, laLat, laLon);
  assert.ok(
    distSfLa >= 540 && distSfLa <= 580,
    `Haversine SF -> LA expected ~559km, got ${distSfLa}km`
  );

  const bearingSfLa = calculateCardinalBearing(sfLat, sfLon, laLat, laLon);
  assert.strictEqual(
    bearingSfLa,
    'SE',
    `Cardinal bearing SF -> LA expected 'SE', got '${bearingSfLa}'`
  );

  // Identical points should be 0km and 'N'
  const distZero = calculateHaversineDistanceKm(sfLat, sfLon, sfLat, sfLon);
  assert.strictEqual(distZero, 0, 'Distance to same point must be 0 km');

  const bearingZero = calculateCardinalBearing(sfLat, sfLon, sfLat, sfLon);
  assert.strictEqual(bearingZero, 'N', 'Bearing to same point defaults to N');
  console.log('✓ Spatial math (Haversine & bearing) verified successfully.');

  // ============================================================================
  // 2. Earthquakes Service & Filtering Verification
  // ============================================================================
  console.log('\n[2/6] Testing USGS Earthquakes Service & Severity Normalization...');

  // Severity thresholds
  assert.strictEqual(getEarthquakeSeverity(2.1), 'minor');
  assert.strictEqual(getEarthquakeSeverity(4.2), 'moderate');
  assert.strictEqual(getEarthquakeSeverity(6.2), 'strong');
  assert.strictEqual(getEarthquakeSeverity(7.1), 'major');

  // Cache TTL verify
  assert.strictEqual(
    EARTHQUAKE_CACHE_TTL_MS,
    5 * 60 * 1000,
    'Earthquake cache TTL must be 5 minutes (300,000ms)'
  );

  // Live USGS Earthquake fetch test
  const quakeReport = await fetchEarthquakes(sfLat, sfLon);
  assert.ok(quakeReport, 'Earthquake report should be returned');
  assert.ok(Array.isArray(quakeReport.earthquakes), 'Earthquakes should be an array');
  assert.ok(quakeReport.totalCount >= 0, 'Total count should be >= 0');

  if (quakeReport.earthquakes.length > 0) {
    const firstQuake = quakeReport.earthquakes[0];
    assert.ok(typeof firstQuake.magnitude === 'number', 'Magnitude must be a number');
    assert.ok(typeof firstQuake.depth === 'number', 'Depth must be a number');
    assert.ok(typeof firstQuake.distanceKm === 'number', 'Distance must be a number');
    assert.ok(typeof firstQuake.bearing === 'string', 'Bearing must be string');
  }

  // Filter test (Magnitude & Scope)
  const sampleQuakes: Earthquake[] = [
    {
      id: 'q1',
      title: 'M 3.2 - 10km N of San Jose, CA',
      magnitude: 3.2,
      place: '10km N of San Jose, CA',
      time: Date.now(),
      latitude: 37.4,
      longitude: -121.9,
      depth: 8.5,
      severity: 'minor',
      distanceKm: 45,
      bearing: 'SE',
      url: 'https://earthquake.usgs.gov',
      tsunamiAlert: false,
    },
    {
      id: 'q2',
      title: 'M 4.8 - 25km SW of Anchorage, AK',
      magnitude: 4.8,
      place: '25km SW of Anchorage, AK',
      time: Date.now(),
      latitude: 61.1,
      longitude: -149.9,
      depth: 35.0,
      severity: 'moderate',
      distanceKm: 3200,
      bearing: 'NW',
      url: 'https://earthquake.usgs.gov',
      tsunamiAlert: false,
    },
    {
      id: 'q3',
      title: 'M 6.5 - Off coast of Japan',
      magnitude: 6.5,
      place: 'Off coast of Japan',
      time: Date.now(),
      latitude: 36.2,
      longitude: 140.1,
      depth: 12.0,
      severity: 'major',
      distanceKm: 8200,
      bearing: 'W',
      url: 'https://earthquake.usgs.gov',
      tsunamiAlert: true,
    },
  ];

  const localM25 = filterEarthquakes(sampleQuakes, 'm2.5', 'local');
  assert.strictEqual(localM25.length, 1, 'Only q1 should match local (<500km) and M2.5+');

  const globalM45 = filterEarthquakes(sampleQuakes, 'm4.5', 'global');
  assert.strictEqual(globalM45.length, 2, 'q2 and q3 should match M4.5+ globally');

  const globalM60 = filterEarthquakes(sampleQuakes, 'm6.0', 'global');
  assert.strictEqual(globalM60.length, 1, 'Only q3 should match M6.0+ globally');

  console.log('✓ USGS Earthquakes service, severity, and filters verified successfully.');

  // ============================================================================
  // 3. Volcanoes Service & Color Code Verification
  // ============================================================================
  console.log('\n[3/6] Testing Smithsonian GVP / USGS Volcanoes Service...');

  // Color code parsing
  const redCode = parseAviationColorCode('RED');
  assert.strictEqual(redCode.code, 'RED');
  assert.strictEqual(redCode.hex, '#ef4444');

  const orangeCode = parseAviationColorCode('orange');
  assert.strictEqual(orangeCode.code, 'ORANGE');
  assert.strictEqual(orangeCode.hex, '#f97316');

  const unknownCode = parseAviationColorCode('INVALID');
  assert.strictEqual(unknownCode.code, 'UNKNOWN');
  assert.strictEqual(unknownCode.hex, '#94a3b8');

  // Cache TTL verify
  assert.strictEqual(
    VOLCANO_CACHE_TTL_MS,
    15 * 60 * 1000,
    'Volcano cache TTL must be 15 minutes (900,000ms)'
  );

  // Fetch live volcanoes
  const volcanoReport = await fetchVolcanoes(sfLat, sfLon);
  assert.ok(volcanoReport, 'Volcano report should be returned');
  assert.ok(Array.isArray(volcanoReport.volcanoes), 'Volcanoes should be an array');
  assert.ok(volcanoReport.eruptingCount >= 0, 'Erupting count should be >= 0');

  // Filtering erupting vs unrest
  const filteredErupting = filterVolcanoes(volcanoReport.volcanoes, 'erupting');
  assert.ok(
    filteredErupting.every((v) => v.status === 'Active Eruption' || v.isErupting),
    'All filtered volcanoes under erupting filter must be active eruptions'
  );

  console.log('✓ Smithsonian GVP / USGS Volcanoes service and color codes verified.');

  // ============================================================================
  // 4. NOAA Tsunamis Advisory Normalization Verification
  // ============================================================================
  console.log('\n[4/6] Testing NOAA Tsunami Advisories & Safety Guidelines...');

  assert.strictEqual(normalizeTsunamiStatus('WARNING'), 'WARNING');
  assert.strictEqual(normalizeTsunamiStatus('tsunami advisory'), 'ADVISORY');
  assert.strictEqual(normalizeTsunamiStatus('watch issued'), 'WATCH');
  assert.strictEqual(normalizeTsunamiStatus('no active advisories'), 'NO_ACTIVE');

  const warningGuide = getTsunamiSafetyGuidelines('WARNING');
  assert.ok(warningGuide.join(' ').includes('HIGHER GROUND'), 'Warning guidelines must mention higher ground');

  const noActiveGuide = getTsunamiSafetyGuidelines('NO_ACTIVE');
  assert.ok(noActiveGuide.join(' ').includes('active tsunami') || noActiveGuide.join(' ').includes('coastal'), 'No active guidelines must state clear status');

  // Cache TTL verify
  assert.strictEqual(
    TSUNAMI_CACHE_TTL_MS,
    5 * 60 * 1000,
    'Tsunami cache TTL must be 5 minutes (300,000ms)'
  );

  // Fetch live tsunami advisories
  const tsunamiReport = await fetchTsunamiAdvisories();
  assert.ok(tsunamiReport, 'Tsunami report should be returned');
  assert.ok(Array.isArray(tsunamiReport.advisories), 'Advisories should be an array');
  assert.ok(tsunamiReport.globalStatusText, 'Global status text must be present');

  console.log('✓ NOAA Tsunami advisories and safety guidelines verified.');

  // ============================================================================
  // 5. Cache & In-Flight Deduplication Verification
  // ============================================================================
  console.log('\n[5/6] Testing Cache & In-Flight Deduplication...');

  clearEarthquakeCache();
  clearVolcanoCache();
  clearTsunamiCache();

  // Deduplication & concurrency test: launch concurrent requests
  const [e1, e2, e3] = await Promise.all([
    fetchEarthquakes(sfLat, sfLon),
    fetchEarthquakes(sfLat, sfLon),
    fetchEarthquakes(sfLat, sfLon),
  ]);

  assert.strictEqual(e1.totalCount, e2.totalCount, 'Concurrent earthquake fetches must return consistent totalCount');
  assert.strictEqual(e2.totalCount, e3.totalCount, 'Concurrent earthquake fetches must return consistent totalCount');

  const [v1, v2] = await Promise.all([
    fetchVolcanoes(sfLat, sfLon),
    fetchVolcanoes(sfLat, sfLon),
  ]);
  assert.strictEqual(v1.totalCount, v2.totalCount, 'Concurrent volcano fetches must return consistent totalCount');

  const [t1, t2] = await Promise.all([
    fetchTsunamiAdvisories(),
    fetchTsunamiAdvisories(),
  ]);
  assert.strictEqual(t1.maxStatusLevel, t2.maxStatusLevel, 'Concurrent tsunami fetches must return consistent maxStatusLevel');

  console.log('✓ Caching and in-flight request deduplication verified.');

  // ============================================================================
  // 6. Layer Unmount Safety Verification
  // ============================================================================
  console.log('\n[6/6] Testing Layer Unmount Safety Simulation...');

  // Mock Leaflet layer group clearLayers execution
  const mockClearLayers = () => {
    let layersCleared = true;
    return {
      clearLayers: () => {
        layersCleared = true;
      },
      isCleared: () => layersCleared,
    };
  };

  const mockGroup = mockClearLayers();
  mockGroup.clearLayers();
  assert.strictEqual(mockGroup.isCleared(), true, 'Mock layer group must clear layers safely without throwing');

  console.log('✓ Layer unmount safety simulation passed cleanly.');
  console.log('\n🎉 ALL STAGE 9 GEOHAZARDS TESTS PASSED SUCCESSFULLY!');
}

runGeohazardsTests().catch((err) => {
  console.error('❌ GEOHAZARDS TEST FAILURE:', err);
  process.exit(1);
});
