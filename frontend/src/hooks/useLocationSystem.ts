'use client';

import { useState, useCallback, useEffect } from 'react';
import { ActiveLocation, GeocodingResult, GeolocationError, LocationState } from '@/types/location';
import { DEFAULT_ACTIVE_LOCATION, findMatchingPreset } from '@/lib/presetLocations';
import {
  parseCoordinateInput,
  searchGeocodingLocations,
  createLocationFromCoordinates,
  createLocationFromGeocoding,
} from '@/lib/geocodingService';
import { persistActiveLocation, getRecentPersistedLocations } from '@/lib/locationPersistenceService';

export interface QueryResolutionResult {
  status: 'COORDINATES_RESOLVED' | 'PRESET_RESOLVED' | 'SINGLE_RESULT' | 'MULTIPLE_RESULTS' | 'NO_RESULTS' | 'ERROR';
  location?: ActiveLocation;
  results?: GeocodingResult[];
  error?: string;
}

export function useLocationSystem(initialLocation: ActiveLocation = DEFAULT_ACTIVE_LOCATION) {
  const [state, setState] = useState<LocationState>({
    activeLocation: initialLocation,
    isLoading: false,
    error: null,
  });
  const [savedLocations, setSavedLocations] = useState<ActiveLocation[]>([]);

  // Load initial saved locations on mount
  useEffect(() => {
    let isMounted = true;
    getRecentPersistedLocations(5)
      .then((locs) => {
        if (isMounted) {
          setSavedLocations(locs);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Helper to persist location to Supabase and immediately synchronize saved locations UI.
   */
  const handlePersistAndRefresh = useCallback((location: ActiveLocation) => {
    persistActiveLocation(location)
      .then(async (success) => {
        if (success) {
          const freshLocations = await getRecentPersistedLocations(5);
          setSavedLocations(freshLocations);
        }
      })
      .catch(() => {});
  }, []);

  /**
   * Request device location via browser Geolocation API.
   * Strictly user-initiated single-shot query (no continuous watchPosition).
   */
  const requestDeviceLocation = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: {
          type: 'UNSUPPORTED',
          message: 'Geolocation is not supported by your current browser. You can select a city manually.',
        },
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newLocation: ActiveLocation = {
          id: `loc-device-${Date.now()}`,
          name: 'Current Location',
          latitude: Number(latitude.toFixed(4)),
          longitude: Number(longitude.toFixed(4)),
          accuracy: accuracy ? Math.round(accuracy) : undefined,
          source: 'device',
          timestamp: new Date().toISOString(),
        };

        setState({
          activeLocation: newLocation,
          isLoading: false,
          error: null,
        });
        handlePersistAndRefresh(newLocation);
      },
      (geoError) => {
        let errorPayload: GeolocationError;

        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            errorPayload = {
              type: 'PERMISSION_DENIED',
              message: 'Location access was denied. You can select a location manually or pick a preset city.',
            };
            break;
          case geoError.POSITION_UNAVAILABLE:
            errorPayload = {
              type: 'POSITION_UNAVAILABLE',
              message: 'Your device location is currently unavailable. Please verify your connection or select a city manually.',
            };
            break;
          case geoError.TIMEOUT:
            errorPayload = {
              type: 'TIMEOUT',
              message: 'Location request timed out. Please try again or select a city manually.',
            };
            break;
          default:
            errorPayload = {
              type: 'UNKNOWN',
              message: 'Unable to determine your location. Please select a city manually.',
            };
            break;
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorPayload,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [handlePersistAndRefresh]);

  /**
   * Set active location atomically from a manual selection (preset, coordinate, or geocoding selection).
   * Also asynchronously persists to Supabase without blocking UI updates.
   */
  const setManualLocation = useCallback((location: ActiveLocation) => {
    const updatedLocation: ActiveLocation = {
      ...location,
      source: location.source || 'manual',
      timestamp: new Date().toISOString(),
    };
    setState({
      activeLocation: updatedLocation,
      isLoading: false,
      error: null,
    });
    handlePersistAndRefresh(updatedLocation);
  }, [handlePersistAndRefresh]);

  /**
   * Universal location resolver:
   * 1. Checks if input is direct coordinates (validates range -90..90, -180..180).
   * 2. Checks if input is an exact preset city.
   * 3. Queries Open-Meteo Geocoding REST API for place names.
   * 4. Returns structured status and results without ever decoupling name from coordinates.
   */
  const resolveLocationQuery = useCallback(
    async (query: string): Promise<QueryResolutionResult> => {
      const trimmed = query.trim();
      if (!trimmed) {
        return {
          status: 'ERROR',
          error: 'Please enter a city name, place, or coordinates.',
        };
      }

      setState((prev) => ({ ...prev, error: null }));

      // 1. Direct Coordinate Parsing
      try {
        const parsedCoords = parseCoordinateInput(trimmed);
        if (parsedCoords) {
          const loc = createLocationFromCoordinates(parsedCoords.latitude, parsedCoords.longitude);
          setManualLocation(loc);
          return { status: 'COORDINATES_RESOLVED', location: loc };
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.';
        const errorObj: GeolocationError = {
          type: 'INVALID_COORDINATES',
          message,
        };
        setState((prev) => ({ ...prev, error: errorObj }));
        return { status: 'ERROR', error: message };
      }

      // 2. Preset Locations Match (Instant local resolution)
      const matchedPreset = findMatchingPreset(trimmed);
      if (matchedPreset && matchedPreset.name.toLowerCase() === trimmed.toLowerCase()) {
        setManualLocation(matchedPreset);
        return { status: 'PRESET_RESOLVED', location: matchedPreset };
      }

      // 3. Open-Meteo Geocoding API Search
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const results = await searchGeocodingLocations(trimmed);

        if (results.length === 0) {
          const notFoundError: GeolocationError = {
            type: 'NOT_FOUND',
            message: 'Location not found. Try another city, country, or coordinates.',
          };
          setState((prev) => ({ ...prev, isLoading: false, error: notFoundError }));
          return { status: 'NO_RESULTS', error: notFoundError.message };
        }

        if (results.length === 1) {
          // Exactly 1 unambiguous result: resolve immediately
          const resolvedLoc = createLocationFromGeocoding(results[0]);
          setManualLocation(resolvedLoc);
          return { status: 'SINGLE_RESULT', location: resolvedLoc, results };
        }

        // Multiple results: return all results so user can choose disambiguation
        setState((prev) => ({ ...prev, isLoading: false, error: null }));
        return { status: 'MULTIPLE_RESULTS', results };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unable to search for this location. Please try again.';
        const errorObj: GeolocationError = {
          type: 'UNKNOWN',
          message,
        };
        setState((prev) => ({ ...prev, isLoading: false, error: errorObj }));
        return { status: 'ERROR', error: message };
      }
    },
    [setManualLocation]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    activeLocation: state.activeLocation,
    isLoading: state.isLoading,
    error: state.error,
    savedLocations,
    requestDeviceLocation,
    setManualLocation,
    resolveLocationQuery,
    clearError,
  };
}
