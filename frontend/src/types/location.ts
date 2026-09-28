/**
 * Location data models.
 * Serves as the single source of truth for active location and maps directly
 * to future GraphQL query inputs (latitude, longitude).
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type LocationSource = 'device' | 'manual';

export interface ActiveLocation {
  id: string;
  name: string;
  country?: string;
  state?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  accuracy?: number; // Accuracy in meters when provided by device geolocation
  timezone?: string;
  source: LocationSource;
  timestamp: string;
}

export type Location = ActiveLocation;

export interface GeocodingResult {
  id: number | string;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  countryCode?: string;
  admin1?: string;
  timezone?: string;
}

export interface GeolocationError {
  type: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED' | 'INVALID_COORDINATES' | 'NOT_FOUND' | 'UNKNOWN';
  message: string;
}

export interface LocationState {
  activeLocation: ActiveLocation;
  isLoading: boolean;
  error: GeolocationError | null;
}

