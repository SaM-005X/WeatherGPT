/**
 * RainViewer Weather Radar Service
 *
 * Provider: RainViewer Public Weather Maps API v2
 * Documentation: https://www.rainviewer.com/api.html
 *
 * Responsibilities:
 * - Fetches latest Doppler radar timestamps & frame metadata from RainViewer
 * - Constructs standard Leaflet {z}/{x}/{y} tile URL templates
 * - Implements a 5-minute in-memory cache to prevent redundant requests
 * - In-flight request deduplication to collapse concurrent callers into one fetch
 * - Timeout protection (5000ms) with AbortController
 * - Graceful stale-fallback when network fails
 * - Provides GIS configuration constants (maxNativeZoom: 7) for seamless Leaflet zooming
 */

export const RAINVIEWER_API_ENDPOINT = 'https://api.rainviewer.com/public/weather-maps.json';

export const RAINVIEWER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const RAINVIEWER_DEFAULT_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Standard Leaflet layer configuration for RainViewer radar tiles.
 *
 * NOTE ON ZOOM LEVELS:
 * RainViewer native radar tiles cap at zoom level 7.
 * Our application map defaults to zoom level 11.
 * By setting maxNativeZoom: 7 and maxZoom: 18, Leaflet automatically downloads
 * zoom 7 tiles and scales/interpolates them smoothly on the client for higher zoom
 * levels (8 to 18), preventing 404 tile errors or missing radar overlays.
 */
export const RAINVIEWER_LEAFLET_CONFIG = {
  maxNativeZoom: 7,
  maxZoom: 18,
  tileSize: 256,
  opacity: 0.65,
  zIndex: 20,
  attribution: 'Radar data &copy; <a href="https://www.rainviewer.com" target="_blank" rel="noopener noreferrer">RainViewer</a>',
} as const;

export interface RainViewerFrame {
  time: number; // Unix timestamp in seconds
  path: string; // e.g., "/v2/radar/84794ab66503"
}

export interface RadarTimelineFrame {
  time: number; // Unix timestamp in seconds
  timeIso: string;
  localTime: string;
  path: string;
  tileUrlTemplate: string;
  type: 'past' | 'nowcast';
}

export interface RainViewerApiResponse {
  version: string;
  generated: number;
  host: string;
  radar?: {
    past?: RainViewerFrame[];
    nowcast?: RainViewerFrame[];
  };
  satellite?: {
    infrared?: RainViewerFrame[];
  };
}

export interface RadarMetadata {
  host: string;
  path: string;
  time: number;
  timeIso: string;
  tileUrlTemplate: string;
  cachedAt: number;
  isStale: boolean;
  frames: RadarTimelineFrame[];
  currentFrameIndex: number;
  satelliteInfrared?: {
    time: number;
    tileUrlTemplate: string;
  } | null;
}

export interface CloudTileConfig {
  urlTemplate: string;
  attribution: string;
  maxNativeZoom: number;
  maxZoom: number;
  source: string;
}

export interface RainViewerCacheStatus {
  isCached: boolean;
  isFresh: boolean;
  ageMs: number;
  timeIso?: string;
  inFlight: boolean;
}

// In-memory cache & deduplication state
let cachedMetadata: RadarMetadata | null = null;
let inFlightRequest: Promise<RadarMetadata> | null = null;

/**
 * Constructs the Leaflet Slippy Map tile URL template for RainViewer.
 *
 * Format: {host}{path}/{size}/{z}/{x}/{y}/{colorScheme}/{options}.png
 * - size: 256 (standard Leaflet tile size)
 * - colorScheme: 2 (Universal Blue standard radar palette)
 * - options: "1_1" (smooth precipitation smoothing + snow color distinction)
 */
export function buildRadarTileUrlTemplate(
  host: string,
  path: string,
  size: 256 | 512 = 256,
  colorScheme = 2,
  options = '1_1'
): string {
  if (!host || typeof host !== 'string') {
    throw new Error('Invalid host provided for RainViewer tile template');
  }
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid path provided for RainViewer tile template');
  }

  const cleanHost = host.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  return `${cleanHost}${cleanPath}/${size}/{z}/{x}/{y}/${colorScheme}/${options}.png`;
}

/**
 * Constructs the Leaflet Slippy Map tile URL template for RainViewer Satellite Infrared tiles.
 *
 * Format: {host}{path}/{size}/{z}/{x}/{y}/{colorScheme}/{options}.png
 * - size: 256
 * - colorScheme: 0 (black/white infrared clouds)
 * - options: "0_0" (standard rendering)
 */
export function buildSatelliteInfraredTileUrlTemplate(
  host: string,
  path: string,
  size: 256 | 512 = 256,
  colorScheme = 0,
  options = '0_0'
): string {
  if (!host || typeof host !== 'string') {
    throw new Error('Invalid host provided for RainViewer satellite infrared tile template');
  }
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid path provided for RainViewer satellite infrared tile template');
  }

  const cleanHost = host.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  return `${cleanHost}${cleanPath}/${size}/{z}/{x}/{y}/${colorScheme}/${options}.png`;
}

/**
 * Retrieves the recommended keyless cloud tile layer configuration.
 * Uses NASA GIBS MODIS Terra Cloud Fraction Day as the reliable, open, transparent cloud layer.
 */
export function getCloudTileConfig(date?: string): CloudTileConfig {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  return {
    urlTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Cloud_Fraction_Day/default/${targetDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
    attribution: 'Cloud imagery &copy; <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener noreferrer">NASA EOSDIS GIBS</a>',
    maxNativeZoom: 6,
    maxZoom: 18,
    source: 'NASA GIBS MODIS Cloud Fraction',
  };
}

/**
 * Validates and extracts the latest radar frame from a RainViewer API response.
 */
export function parseRainViewerResponse(
  data: unknown,
  cachedAt = Date.now()
): RadarMetadata {
  if (!data || typeof data !== 'object') {
    throw new Error('Malformed RainViewer response: Response body must be an object.');
  }

  const response = data as Partial<RainViewerApiResponse>;

  if (typeof response.host !== 'string' || !response.host.trim()) {
    throw new Error('Malformed RainViewer response: Missing or invalid "host" field.');
  }

  const pastFrames = response.radar?.past;
  const nowcastFrames = response.radar?.nowcast || [];

  if (!Array.isArray(pastFrames) || pastFrames.length === 0) {
    throw new Error('Malformed RainViewer response: No past radar frames available in "radar.past".');
  }

  // Build full frame timeline sequence (past + nowcast)
  const frames: RadarTimelineFrame[] = [];

  for (const f of pastFrames) {
    if (f && typeof f.path === 'string' && typeof f.time === 'number') {
      const tileUrlTemplate = buildRadarTileUrlTemplate(response.host, f.path);
      const timeIso = new Date(f.time * 1000).toISOString();
      const localTime = new Date(f.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      frames.push({
        time: f.time,
        timeIso,
        localTime,
        path: f.path,
        tileUrlTemplate,
        type: 'past',
      });
    }
  }

  for (const f of nowcastFrames) {
    if (f && typeof f.path === 'string' && typeof f.time === 'number') {
      const tileUrlTemplate = buildRadarTileUrlTemplate(response.host, f.path);
      const timeIso = new Date(f.time * 1000).toISOString();
      const localTime = new Date(f.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      frames.push({
        time: f.time,
        timeIso,
        localTime,
        path: f.path,
        tileUrlTemplate,
        type: 'nowcast',
      });
    }
  }

  if (frames.length === 0) {
    throw new Error('Malformed RainViewer response: Latest radar frame is missing path or time.');
  }

  // Extract optional satellite infrared frame if present
  let satelliteInfrared: { time: number; tileUrlTemplate: string } | null = null;
  const infraredFrames = response.satellite?.infrared;
  if (Array.isArray(infraredFrames) && infraredFrames.length > 0) {
    const latestInfrared = infraredFrames[infraredFrames.length - 1];
    if (latestInfrared?.path && typeof latestInfrared?.time === 'number') {
      satelliteInfrared = {
        time: latestInfrared.time,
        tileUrlTemplate: buildSatelliteInfraredTileUrlTemplate(response.host, latestInfrared.path),
      };
    }
  }

  // Default to the most recent past radar frame (last in the past array)
  const latestPastIndex = pastFrames.length - 1;
  const latestFrame = frames[latestPastIndex] || frames[frames.length - 1];

  return {
    host: response.host,
    path: latestFrame.path,
    time: latestFrame.time,
    timeIso: latestFrame.timeIso,
    tileUrlTemplate: latestFrame.tileUrlTemplate,
    cachedAt,
    isStale: false,
    frames,
    currentFrameIndex: latestPastIndex >= 0 ? latestPastIndex : 0,
    satelliteInfrared,
  };
}

/**
 * Fetches the latest RainViewer radar metadata with 5-minute caching and request deduplication.
 *
 * @param options.forceRefresh - Bypass cache and fetch fresh metadata
 * @param options.timeoutMs - Custom network timeout in milliseconds (defaults to 5000ms)
 * @param options.fetchFn - Custom fetch implementation (useful for tests and dependency injection)
 */
export async function getLatestRadarMetadata(options?: {
  forceRefresh?: boolean;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}): Promise<RadarMetadata> {
  const now = Date.now();
  const forceRefresh = options?.forceRefresh ?? false;
  const timeoutMs = options?.timeoutMs ?? RAINVIEWER_DEFAULT_TIMEOUT_MS;
  const customFetch = options?.fetchFn ?? fetch;

  // 1. Check in-memory cache
  if (!forceRefresh && cachedMetadata) {
    const ageMs = now - cachedMetadata.cachedAt;
    if (ageMs < RAINVIEWER_CACHE_TTL_MS) {
      return { ...cachedMetadata, isStale: false };
    }
  }

  // 2. Return in-flight request if one is already active (deduplication)
  if (inFlightRequest) {
    return inFlightRequest;
  }

  // 3. Launch isolated network request with 1-retry fallback
  const fetchPromise = (async (): Promise<RadarMetadata> => {
    const executeAttempt = async (): Promise<RadarMetadata> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await customFetch(RAINVIEWER_API_ENDPOINT, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`RainViewer API HTTP error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        return parseRainViewerResponse(json, Date.now());
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      let metadata: RadarMetadata;
      try {
        metadata = await executeAttempt();
      } catch {
        // Attempt single retry for transient network drop before failing or using cache
        metadata = await executeAttempt();
      }

      // Update in-memory cache on success
      cachedMetadata = metadata;
      return metadata;
    } catch (error) {
      // 4. Stale fallback: If previous data exists in cache, return it with isStale: true
      if (cachedMetadata) {
        return {
          ...cachedMetadata,
          isStale: true,
        };
      }

      const isAbort = error instanceof Error && error.name === 'AbortError';
      const errorMessage = isAbort
        ? `RainViewer API request timed out after ${timeoutMs}ms.`
        : error instanceof Error
        ? error.message
        : 'Unknown RainViewer network failure.';

      throw new Error(`Failed to load RainViewer radar metadata: ${errorMessage}`);
    } finally {
      inFlightRequest = null;
    }
  })();

  inFlightRequest = fetchPromise;
  return fetchPromise;
}

/**
 * Returns current cache status (useful for tests and diagnostics).
 */
export function getRainViewerCacheStatus(now = Date.now()): RainViewerCacheStatus {
  if (!cachedMetadata) {
    return {
      isCached: false,
      isFresh: false,
      ageMs: 0,
      inFlight: inFlightRequest !== null,
    };
  }

  const ageMs = Math.max(0, now - cachedMetadata.cachedAt);
  return {
    isCached: true,
    isFresh: ageMs < RAINVIEWER_CACHE_TTL_MS,
    ageMs,
    timeIso: cachedMetadata.timeIso,
    inFlight: inFlightRequest !== null,
  };
}

/**
 * Clears the in-memory cache and in-flight promise (useful for test isolation).
 */
export function clearRainViewerCache(): void {
  cachedMetadata = null;
  inFlightRequest = null;
}
