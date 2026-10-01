/**
 * AWS AppSync Direct Lambda Resolver Handler
 *
 * Serverless execution entry point for AWS AppSync GraphQL API queries.
 * Handles Query.weatherByCoordinates by delegating directly to the existing
 * weather domain service (weatherService.ts) without duplicating provider logic.
 */

import type { AppSyncResolverEvent, Context } from 'aws-lambda';
import * as weatherService from '@/lib/weatherService';
import type { WeatherReport } from '@/types/weather';
export type { WeatherReport };
import { Logger } from '../utils/logger';

const logger = new Logger('weather-gpt-appsync');

export interface CoordinatesInput {
  latitude: number;
  longitude: number;
}

export interface WeatherByCoordinatesArguments {
  coordinates?: CoordinatesInput;
}

export interface AppSyncHandlerDependencies {
  fetchWeatherData?: typeof weatherService.fetchWeatherData;
  validateCoordinates?: typeof weatherService.validateCoordinates;
}

/**
 * Sanitizes error messages to prevent leaking internal file paths or credentials
 * while preserving actionable operational context for GraphQL clients.
 */
function sanitizeError(err: unknown): Error {
  if (err instanceof Error) {
    let sanitized = err.message
      .replace(/[a-zA-Z]:\\[^\s]+/g, '[redacted_path]')
      .replace(/\/(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+/g, '[redacted_path]');
    sanitized = sanitized.replace(/([?&](?:apikey|key|secret)=)[^&\s]+/gi, '$1[redacted]');
    return new Error(sanitized);
  }
  return new Error('Unexpected error occurred while resolving weather data.');
}

/**
 * Main AppSync Direct Lambda Resolver Handler.
 *
 * Receives the direct AppSync resolver context (no VTL mapping template),
 * validates the operation and coordinates, invokes the core weather domain service,
 * and returns the normalized WeatherReport matching the GraphQL schema.
 */
export async function handler(
  event: AppSyncResolverEvent<WeatherByCoordinatesArguments>,
  context?: Context,
  deps: AppSyncHandlerDependencies = {}
): Promise<WeatherReport> {
  const fetchWeather = deps.fetchWeatherData ?? weatherService.fetchWeatherData;
  const validateCoords = deps.validateCoordinates ?? weatherService.validateCoordinates;
  const startTime = Date.now();
  const requestId = context?.awsRequestId || 'local-appsync-req';
  logger.setRequestId(requestId);

  const parentTypeName = event?.info?.parentTypeName;
  const fieldName = event?.info?.fieldName;

  logger.info('AppSync resolver invoked', {
    parentTypeName,
    fieldName,
    requestId,
  });

  // 1. Validate Parent Type
  if (parentTypeName !== 'Query') {
    const errorMsg = `Unsupported parent type: "${parentTypeName || 'unknown'}". Only "Query" is supported.`;
    logger.warn(errorMsg);
    throw new Error(errorMsg);
  }

  // 2. Dispatch Supported Field
  if (fieldName !== 'weatherByCoordinates') {
    const errorMsg = `Unsupported resolver field: "${fieldName || 'unknown'}". Only "weatherByCoordinates" is currently supported.`;
    logger.warn(errorMsg);
    throw new Error(errorMsg);
  }

  // 3. Extract and Validate Coordinates Argument
  const coordinates = event?.arguments?.coordinates;
  if (!coordinates) {
    const errorMsg = 'Invalid input: coordinates argument is required.';
    logger.warn(errorMsg);
    throw new Error(errorMsg);
  }

  const { latitude, longitude } = coordinates;
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    const errorMsg = 'Invalid coordinates: Both latitude and longitude are required.';
    logger.warn(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    validateCoords(latitude, longitude);
  } catch (validationErr: unknown) {
    const message = validationErr instanceof Error ? validationErr.message : 'Invalid coordinates provided.';
    logger.warn('Coordinate validation rejection', { latitude, longitude, error: message });
    throw new Error(message);
  }

  // 4. Delegate to Existing Core Weather Service
  try {
    logger.info('Calling weather domain service', { latitude, longitude });
    const weatherReport = await fetchWeather(latitude, longitude, {
      forceRefresh: false,
    });

    const durationMs = Date.now() - startTime;
    logger.info('AppSync weatherByCoordinates resolved successfully', {
      latitude,
      longitude,
      locationId: weatherReport.locationId,
      durationMs,
    });

    return weatherReport;
  } catch (serviceErr: unknown) {
    const durationMs = Date.now() - startTime;
    logger.error('Weather domain service failure in AppSync handler', serviceErr, {
      latitude,
      longitude,
      durationMs,
    });
    throw sanitizeError(serviceErr);
  }
}
