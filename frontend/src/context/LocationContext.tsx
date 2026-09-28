'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ActiveLocation, GeolocationError } from '@/types/location';
import { UnitSystem } from '@/types/weather';
import { useLocationSystem, QueryResolutionResult } from '@/hooks/useLocationSystem';

export interface LocationContextValue {
  // Location System
  activeLocation: ActiveLocation;
  isLoadingLocation: boolean;
  locationError: GeolocationError | null;
  savedLocations: ActiveLocation[];
  requestDeviceLocation: () => void;
  setManualLocation: (location: ActiveLocation) => void;
  resolveLocationQuery: (query: string) => Promise<QueryResolutionResult>;
  clearLocationError: () => void;

  // Global Unit System (°C / °F)
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
  toggleUnits: () => void;

  // Global Search Modal / Drawer Trigger
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
  openLocationSearch: () => void;
  closeLocationSearch: () => void;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const {
    activeLocation,
    isLoading: isLoadingLocation,
    error: locationError,
    savedLocations,
    requestDeviceLocation,
    setManualLocation,
    resolveLocationQuery,
    clearError: clearLocationError,
  } = useLocationSystem();

  // Global Unit System Preference (°C metric by default)
  const [units, setUnits] = useState<UnitSystem>('metric');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);

  const toggleUnits = useCallback(() => {
    setUnits((prev) => (prev === 'metric' ? 'imperial' : 'metric'));
  }, []);

  const openLocationSearch = useCallback(() => {
    setIsSearchModalOpen(true);
  }, []);

  const closeLocationSearch = useCallback(() => {
    setIsSearchModalOpen(false);
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      activeLocation,
      isLoadingLocation,
      locationError,
      savedLocations,
      requestDeviceLocation,
      setManualLocation,
      resolveLocationQuery,
      clearLocationError,
      units,
      setUnits,
      toggleUnits,
      isSearchModalOpen,
      setIsSearchModalOpen,
      openLocationSearch,
      closeLocationSearch,
    }),
    [
      activeLocation,
      isLoadingLocation,
      locationError,
      savedLocations,
      requestDeviceLocation,
      setManualLocation,
      resolveLocationQuery,
      clearLocationError,
      units,
      toggleUnits,
      isSearchModalOpen,
      openLocationSearch,
      closeLocationSearch,
    ]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}
