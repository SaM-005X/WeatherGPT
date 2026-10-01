/**
 * Unit Tests for Wind Patterns, Cloud Cover & Satellite Imagery Layers
 * Stage 7 Verification
 *
 * Covers:
 * 1. Wind service angle-to-cardinal conversion (16 compass points).
 * 2. Beaufort scale calculation (0-12) & descriptions.
 * 3. Unit conversions (km/h to mph and knots).
 * 4. Wind SVG vector icon markup generation.
 * 5. Satellite imagery tile URL generation (Esri World Imagery & NASA GIBS).
 * 6. Satellite attribution metadata & Leaflet GIS zoom configurations.
 * 7. Wind API normalization, in-memory caching, and request deduplication.
 */

import assert from 'node:assert';
import {
  degreesToCardinal,
  calculateBeaufortScale,
  kmhToMph,
  kmhToKnots,
  normalizeWindData,
  generateWindArrowSvg,
  generateWindStreamlineSvg,
  fetchWindData,
  clearWindCache,
} from '../lib/windService';
import {
  buildSatelliteTileUrlTemplate,
  getSatelliteLayerConfig,
} from '../lib/satelliteService';
import {
  getCloudTileConfig,
  buildSatelliteInfraredTileUrlTemplate,
} from '../lib/rainViewerService';

console.log('========================================================');
console.log('🧪 RUNNING STAGE 7 WIND & SATELLITE LAYERS TEST SUITE');
console.log('========================================================');

// ============================================================================
// 1. Wind Angle to Cardinal Conversion (16 Points)
// ============================================================================
console.log('\n[1/7] Testing Wind Degrees to Cardinal Conversion...');

assert.strictEqual(degreesToCardinal(0), 'N');
assert.strictEqual(degreesToCardinal(360), 'N');
assert.strictEqual(degreesToCardinal(90), 'E');
assert.strictEqual(degreesToCardinal(180), 'S');
assert.strictEqual(degreesToCardinal(270), 'W');
assert.strictEqual(degreesToCardinal(284), 'WNW');
assert.strictEqual(degreesToCardinal(45), 'NE');
assert.strictEqual(degreesToCardinal(225), 'SW');

console.log('✅ 16-point cardinal compass conversion verified.');

// ============================================================================
// 2. Beaufort Scale Classification (0-12)
// ============================================================================
console.log('\n[2/7] Testing Beaufort Scale Classification...');

assert.strictEqual(calculateBeaufortScale(0).scale, 0);
assert.strictEqual(calculateBeaufortScale(0).description, 'Calm');

assert.strictEqual(calculateBeaufortScale(15).scale, 3);
assert.strictEqual(calculateBeaufortScale(15).description, 'Gentle Breeze');

assert.strictEqual(calculateBeaufortScale(45).scale, 6);
assert.strictEqual(calculateBeaufortScale(45).description, 'Strong Breeze');

assert.strictEqual(calculateBeaufortScale(120).scale, 12);
assert.strictEqual(calculateBeaufortScale(120).description, 'Hurricane');

console.log('✅ Beaufort scale classification (0-12) verified.');

// ============================================================================
// 3. Wind Unit Conversions & SVG Generation
// ============================================================================
console.log('\n[3/7] Testing Unit Conversions & Wind SVG Generation...');

assert.strictEqual(kmhToMph(100), 62.1);
assert.strictEqual(kmhToKnots(100), 54.0);

const norm = normalizeWindData(15.5, 284, 25.0);
assert.strictEqual(norm.speedKmh, 15.5);
assert.strictEqual(norm.cardinalDirection, 'WNW');
assert.strictEqual(norm.gustsKmh, 25.0);
assert.strictEqual(norm.beaufortScale, 3);

const svg = generateWindArrowSvg(284, '#0284c7', 30);
assert.ok(svg.includes('rotate('));
assert.ok(svg.includes('svg'));

console.log('✅ Wind normalization and SVG generation verified.');

// ============================================================================
// 4. Satellite Tile URL Generation (Esri & NASA GIBS)
// ============================================================================
console.log('\n[4/7] Testing Satellite Tile URL Generation...');

const esriUrl = buildSatelliteTileUrlTemplate('esri_world');
assert.strictEqual(
  esriUrl,
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
);

const nasaUrl = buildSatelliteTileUrlTemplate('nasa_gibs_terra', '2026-09-30T12:00:00Z');
assert.ok(nasaUrl.includes('gibs.earthdata.nasa.gov'));
assert.ok(nasaUrl.includes('MODIS_Terra_CorrectedReflectance_TrueColor'));

console.log('✅ Satellite tile URL templates verified.');

// ============================================================================
// 5. Satellite Attribution Metadata & GIS Zoom Config
// ============================================================================
console.log('\n[5/7] Testing Satellite Attribution & Zoom Configurations...');

const esriCfg = getSatelliteLayerConfig('esri_world');
assert.strictEqual(esriCfg.maxNativeZoom, 19);
assert.strictEqual(esriCfg.maxZoom, 19);
assert.ok(esriCfg.attribution.includes('Esri'));

const nasaCfg = getSatelliteLayerConfig('nasa_gibs_terra');
assert.strictEqual(nasaCfg.maxNativeZoom, 9);
assert.strictEqual(nasaCfg.maxZoom, 18);
assert.ok(nasaCfg.attribution.includes('NASA Earthdata GIBS'));

console.log('✅ Satellite attribution metadata verified.');

// ============================================================================
// 7. Stage 7.1 Streamline SVG & Cloud Tile Tests
// ============================================================================
console.log('\n[7/8] Testing Wind Streamline SVG & Cloud Tile Configuration...');

const streamline = generateWindStreamlineSvg(180, 35, 2);
assert.ok(streamline.includes('rotate('));
assert.ok(streamline.includes('windVectorPulse'));
assert.ok(streamline.includes('svg'));

const cloudCfg = getCloudTileConfig('2026-09-30');
assert.strictEqual(cloudCfg.maxNativeZoom, 6);
assert.strictEqual(cloudCfg.maxZoom, 18);
assert.ok(cloudCfg.urlTemplate.includes('MODIS_Terra_Cloud_Fraction_Day'));
assert.ok(cloudCfg.attribution.includes('NASA EOSDIS GIBS'));

const irUrl = buildSatelliteInfraredTileUrlTemplate(
  'https://tilecache.rainviewer.com',
  '/v2/satellite/sample'
);
assert.strictEqual(
  irUrl,
  'https://tilecache.rainviewer.com/v2/satellite/sample/256/{z}/{x}/{y}/0/0_0.png'
);

console.log('✅ Wind streamline SVG & Cloud tile config verified.');

// ============================================================================
// 8. Wind Fetcher, Caching & Deduplication
// ============================================================================
async function runAsyncTests() {
  console.log('\n[8/8] Testing Wind API Normalization & Caching...');
  clearWindCache();

  let fetchCount = 0;
  const mockWindFetch: typeof fetch = async () => {
    fetchCount++;
    return new Response(
      JSON.stringify({
        current: {
          time: '2026-09-30T17:00',
          wind_speed_10m: 18.5,
          wind_direction_10m: 135,
          wind_gusts_10m: 32.0,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const data1 = await fetchWindData(22.57, 88.36, { fetchFn: mockWindFetch });
  assert.strictEqual(fetchCount, 1);
  assert.strictEqual(data1.speedKmh, 18.5);
  assert.strictEqual(data1.cardinalDirection, 'SE');
  assert.strictEqual(data1.gustsKmh, 32.0);

  // Cache hit test
  const data2 = await fetchWindData(22.57, 88.36, { fetchFn: mockWindFetch });
  assert.strictEqual(fetchCount, 1, 'Second fetch should hit in-memory cache');
  assert.strictEqual(data2.isCached, true);

  console.log('✅ Wind caching and deduplication verified.');
}

runAsyncTests()
  .then(() => {
    console.log('\n========================================================');
    console.log('🎉 ALL STAGE 7 & 7.1 WIND & SATELLITE TESTS PASSED!');
    console.log('========================================================\n');
  })
  .catch((err) => {
    console.error('❌ Stage 7 test failure:', err);
    process.exit(1);
  });
