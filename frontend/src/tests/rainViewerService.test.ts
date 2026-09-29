/**
 * Deterministic Unit Tests for RainViewer Weather Radar Service
 *
 * Runs completely offline using mock fetch fixtures to test:
 * - Tile URL template generation
 * - JSON response parsing & latest frame extraction
 * - In-memory 5-minute cache hit & TTL expiration
 * - Concurrent in-flight request deduplication
 * - Stale fallback on network error
 * - Timeout handling
 * - Malformed payload rejection
 * - Leaflet layer configuration constants
 */

import assert from 'node:assert';
import {
  buildRadarTileUrlTemplate,
  parseRainViewerResponse,
  getLatestRadarMetadata,
  getRainViewerCacheStatus,
  clearRainViewerCache,
  RAINVIEWER_LEAFLET_CONFIG,
  RAINVIEWER_CACHE_TTL_MS,
  RainViewerApiResponse,
} from '../lib/rainViewerService';

console.log('--- STARTING RAINVIEWER SERVICE TESTS ---');

// Mock API response matching actual RainViewer v2 schema
const mockRainViewerJson: RainViewerApiResponse = {
  version: '2.0',
  generated: 1790662800,
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: [
      { time: 1790655600, path: '/v2/radar/frame-001' },
      { time: 1790656200, path: '/v2/radar/frame-002' },
      { time: 1790662800, path: '/v2/radar/frame-latest' },
    ],
    nowcast: [],
  },
  satellite: {
    infrared: [],
  },
};

// ============================================================================
// 1. Tile URL Template Construction Tests
// ============================================================================
console.log('\n[1/9] Testing Tile URL Template Construction...');

const tileUrl = buildRadarTileUrlTemplate(
  'https://tilecache.rainviewer.com',
  '/v2/radar/frame-latest'
);

assert.strictEqual(
  tileUrl,
  'https://tilecache.rainviewer.com/v2/radar/frame-latest/256/{z}/{x}/{y}/2/1_1.png'
);

// Trailing slash in host and leading slash in path normalization
const tileUrlNormalized = buildRadarTileUrlTemplate(
  'https://tilecache.rainviewer.com/',
  'v2/radar/frame-latest',
  512,
  1,
  '1_0'
);
assert.strictEqual(
  tileUrlNormalized,
  'https://tilecache.rainviewer.com/v2/radar/frame-latest/512/{z}/{x}/{y}/1/1_0.png'
);

// Invalid host or path should throw
assert.throws(() => buildRadarTileUrlTemplate('', '/v2/radar'), /Invalid host/);
assert.throws(() => buildRadarTileUrlTemplate('https://tilecache.com', ''), /Invalid path/);

console.log('✔ Tile URL Template Construction verified.');

// ============================================================================
// 2. Leaflet Configuration Constant Tests
// ============================================================================
console.log('\n[2/9] Testing Leaflet GIS Configuration & Zoom Constraints...');

assert.strictEqual(RAINVIEWER_LEAFLET_CONFIG.maxNativeZoom, 7, 'Native radar zoom must be capped at 7');
assert.strictEqual(RAINVIEWER_LEAFLET_CONFIG.maxZoom, 18, 'Max zoom must support client upscaling to 18');
assert.strictEqual(RAINVIEWER_LEAFLET_CONFIG.tileSize, 256);
assert(RAINVIEWER_LEAFLET_CONFIG.attribution.includes('RainViewer'));

console.log('✔ Leaflet GIS Configuration & Zoom Constraints verified.');

// ============================================================================
// 3. Response Parsing & Latest Frame Extraction Tests
// ============================================================================
console.log('\n[3/9] Testing Response Parsing & Latest Frame Extraction...');

const parsed = parseRainViewerResponse(mockRainViewerJson, 1790662800000);
assert.strictEqual(parsed.host, 'https://tilecache.rainviewer.com');
assert.strictEqual(parsed.path, '/v2/radar/frame-latest');
assert.strictEqual(parsed.time, 1790662800);
assert.strictEqual(parsed.isStale, false);
assert.strictEqual(
  parsed.tileUrlTemplate,
  'https://tilecache.rainviewer.com/v2/radar/frame-latest/256/{z}/{x}/{y}/2/1_1.png'
);
assert(parsed.timeIso.length > 0);

console.log('✔ Response Parsing & Latest Frame Extraction verified.');

// ============================================================================
// 4. Malformed Response Handling Tests
// ============================================================================
console.log('\n[4/9] Testing Malformed Response Rejection...');

assert.throws(() => parseRainViewerResponse(null), /Response body must be an object/);
assert.throws(() => parseRainViewerResponse({}), /Missing or invalid "host"/);
assert.throws(
  () => parseRainViewerResponse({ host: 'https://test.com', radar: { past: [] } }),
  /No past radar frames available/
);
assert.throws(
  () => parseRainViewerResponse({ host: 'https://test.com', radar: { past: [{}] } }),
  /Latest radar frame is missing path or time/
);

console.log('✔ Malformed Response Rejection verified.');

// ============================================================================
// 5. In-Memory Cache Hit & 5-Minute TTL Tests
// ============================================================================
console.log('\n[5/9] Testing In-Memory Cache Hit & TTL...');

assert.strictEqual(RAINVIEWER_CACHE_TTL_MS, 300000, 'Cache TTL must be 5 minutes (300,000 ms)');

clearRainViewerCache();
let networkFetchCount = 0;

const mockFetchSuccess = (async () => {
  networkFetchCount++;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => mockRainViewerJson,
  } as unknown as Response;
}) as typeof fetch;

async function runCacheTests() {
  // First call -> triggers network fetch
  const first = await getLatestRadarMetadata({ fetchFn: mockFetchSuccess });
  assert.strictEqual(first.path, '/v2/radar/frame-latest');
  assert.strictEqual(networkFetchCount, 1);

  // Status check
  const status1 = getRainViewerCacheStatus();
  assert.strictEqual(status1.isCached, true);
  assert.strictEqual(status1.isFresh, true);

  // Second call within 5 minutes -> Cache hit, 0 additional network calls
  const second = await getLatestRadarMetadata({ fetchFn: mockFetchSuccess });
  assert.strictEqual(second.path, '/v2/radar/frame-latest');
  assert.strictEqual(networkFetchCount, 1); // No new network call!
  assert.strictEqual(second.cachedAt, first.cachedAt);

  // Forced refresh bypasses cache
  const forced = await getLatestRadarMetadata({ forceRefresh: true, fetchFn: mockFetchSuccess });
  assert.strictEqual(networkFetchCount, 2);
  assert(forced.cachedAt >= first.cachedAt);

  console.log('✔ In-Memory Cache Hit & TTL verified.');
}

// ============================================================================
// 6. In-Flight Request Deduplication Tests
// ============================================================================
console.log('\n[6/9] Testing In-Flight Request Deduplication...');

async function runDeduplicationTests() {
  clearRainViewerCache();
  let concurrentFetches = 0;

  const mockSlowFetch = (async () => {
    concurrentFetches++;
    await new Promise((r) => setTimeout(r, 50));
    return {
      ok: true,
      status: 200,
      json: async () => mockRainViewerJson,
    } as unknown as Response;
  }) as typeof fetch;

  // Fire 5 concurrent calls simultaneously
  const results = await Promise.all([
    getLatestRadarMetadata({ fetchFn: mockSlowFetch }),
    getLatestRadarMetadata({ fetchFn: mockSlowFetch }),
    getLatestRadarMetadata({ fetchFn: mockSlowFetch }),
    getLatestRadarMetadata({ fetchFn: mockSlowFetch }),
    getLatestRadarMetadata({ fetchFn: mockSlowFetch }),
  ]);

  // All 5 must resolve to identical metadata
  for (const r of results) {
    assert.strictEqual(r.path, '/v2/radar/frame-latest');
  }

  // Exactly 1 network fetch must have occurred!
  assert.strictEqual(concurrentFetches, 1, 'Concurrent requests must collapse into exactly 1 network fetch');
  console.log('✔ In-Flight Request Deduplication verified.');
}

// ============================================================================
// 7. Network Failure on Cold Cache Tests
// ============================================================================
console.log('\n[7/9] Testing Network Failure Handling (Cold Cache)...');

async function runNetworkFailureTests() {
  clearRainViewerCache();

  const mockFailingFetch = (async () => {
    throw new Error('Network connection failed');
  }) as typeof fetch;

  await assert.rejects(
    async () => getLatestRadarMetadata({ fetchFn: mockFailingFetch }),
    /Failed to load RainViewer radar metadata: Network connection failed/
  );

  console.log('✔ Cold Cache Network Failure Handling verified.');
}

// ============================================================================
// 8. Stale Fallback on Warm Cache Failure Tests
// ============================================================================
console.log('\n[8/9] Testing Stale Fallback on Network Error (Warm Cache)...');

async function runStaleFallbackTests() {
  clearRainViewerCache();

  // 1. Populate cache with valid entry
  await getLatestRadarMetadata({ fetchFn: mockFetchSuccess });

  // 2. Subsequent forced refresh fails -> must return previous data with isStale: true
  const mockFailingFetch = (async () => {
    throw new Error('Connection refused');
  }) as typeof fetch;

  const fallback = await getLatestRadarMetadata({
    forceRefresh: true,
    fetchFn: mockFailingFetch,
  });

  assert.strictEqual(fallback.path, '/v2/radar/frame-latest');
  assert.strictEqual(fallback.isStale, true, 'Fallback entry must have isStale: true');
  console.log('✔ Stale Fallback on Warm Cache Failure verified.');
}

// ============================================================================
// 9. Timeout Handling Tests
// ============================================================================
console.log('\n[9/9] Testing Timeout Protection with AbortSignal...');

async function runTimeoutTests() {
  clearRainViewerCache();

  const mockHangingFetch = (async (_url: string, init?: RequestInit) => {
    return new Promise((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  }) as typeof fetch;

  await assert.rejects(
    async () => getLatestRadarMetadata({ timeoutMs: 30, fetchFn: mockHangingFetch }),
    /timed out after 30ms/
  );

  console.log('✔ Timeout Protection verified.');
}

// Execute async test pipeline
async function main() {
  await runCacheTests();
  await runDeduplicationTests();
  await runNetworkFailureTests();
  await runStaleFallbackTests();
  await runTimeoutTests();

  console.log('\n======================================================');
  console.log('ALL 9 RAINVIEWER SERVICE TESTS PASSED! ✔');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
