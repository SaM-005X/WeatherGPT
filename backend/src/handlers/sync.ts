/**
 * AWS Lambda Forecast Sync Worker Handler
 *
 * Triggered by Amazon EventBridge scheduled rules (e.g. rate(30 minutes)).
 * Warms and persists forecast data for recent/tracked locations so end-users get instant responses.
 */

import type { ScheduledEvent, Context } from 'aws-lambda';
import { getRecentPersistedLocations } from '@/lib/locationPersistenceService';
import { PRESET_LOCATIONS } from '@/lib/presetLocations';
import { fetchWeatherData } from '@/lib/weatherService';
import { Logger } from '../utils/logger';

const logger = new Logger('weather-gpt-forecast-sync');

export interface SyncLocationDetail {
  locationName: string;
  latitude: number;
  longitude: number;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface SyncResult {
  success: boolean;
  locationsAttempted: number;
  locationsSucceeded: number;
  locationsFailed: number;
  durationMs: number;
  details?: SyncLocationDetail[];
}

/**
 * Core forecast synchronization engine.
 * Sequentially warms weather caches for specified locations with individual failure isolation.
 */
export async function syncLocations(
  locations: Array<{ name: string; latitude: number; longitude: number }>,
  requestId = 'sync-worker'
): Promise<SyncResult> {
  const startTime = Date.now();
  logger.setRequestId(requestId);

  let succeeded = 0;
  let failed = 0;
  const details: SyncLocationDetail[] = [];

  for (const loc of locations) {
    const locStart = Date.now();
    try {
      await fetchWeatherData(loc.latitude, loc.longitude, {
        forceRefresh: true,
      });
      succeeded++;
      const locDurationMs = Date.now() - locStart;
      details.push({
        locationName: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        success: true,
        durationMs: locDurationMs,
      });
      logger.debug(`Warmed forecast for ${loc.name} [${loc.latitude}, ${loc.longitude}] in ${locDurationMs}ms`);
    } catch (err: unknown) {
      failed++;
      const locDurationMs = Date.now() - locStart;
      const errorMsg = err instanceof Error ? err.message : String(err);
      details.push({
        locationName: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        success: false,
        error: errorMsg,
        durationMs: locDurationMs,
      });
      logger.warn(`Failed warming forecast for ${loc.name}`, { error: errorMsg, durationMs: locDurationMs });
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    success: true,
    locationsAttempted: locations.length,
    locationsSucceeded: succeeded,
    locationsFailed: failed,
    durationMs,
    details,
  };
}

export async function handler(
  event?: ScheduledEvent,
  context?: Context
): Promise<SyncResult> {
  const startTime = Date.now();
  const requestId = context?.awsRequestId || 'scheduled-sync';
  logger.setRequestId(requestId);

  logger.info('EventBridge scheduled forecast sync worker invoked', {
    triggerTime: event?.time,
    source: event?.source || 'aws.events',
  });

  try {
    // 1. Retrieve recent/saved locations to warm
    let locations = await getRecentPersistedLocations(5);
    if (!locations || locations.length === 0) {
      logger.info('No persisted locations found; using default presets for warming.');
      locations = PRESET_LOCATIONS.slice(0, 5);
    }
    logger.info(`Retrieved ${locations.length} locations for background forecast warming.`);

    // 2. Fetch and warm weather sequentially with per-location failure isolation
    const result = await syncLocations(locations, requestId);

    logger.info('EventBridge forecast sync worker finished', {
      locationsAttempted: result.locationsAttempted,
      locationsSucceeded: result.locationsSucceeded,
      locationsFailed: result.locationsFailed,
      durationMs: result.durationMs,
    });

    return result;
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    logger.error('Critical failure in forecast sync worker', err, { durationMs });

    return {
      success: false,
      locationsAttempted: 0,
      locationsSucceeded: 0,
      locationsFailed: 0,
      durationMs,
    };
  }
}
