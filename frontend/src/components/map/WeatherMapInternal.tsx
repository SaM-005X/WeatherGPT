'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getLatestRadarMetadata,
  RAINVIEWER_LEAFLET_CONFIG,
} from '@/lib/rainViewerService';

interface WeatherMapInternalProps {
  latitude: number;
  longitude: number;
  locationName?: string;
  accuracy?: number;
  source?: 'device' | 'manual';
  zoom?: number;
  cloudCover?: number;
  conditionDescription?: string;
  condition?: string;
}

export default function WeatherMapInternal({
  latitude,
  longitude,
  locationName = 'Selected Location',
  accuracy,
  source = 'manual',
  zoom = 11,
  cloudCover,
  conditionDescription,
}: WeatherMapInternalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const radarRequestVersionRef = useRef<number>(0);

  // Radar Layer State
  const [isRadarActive, setIsRadarActive] = useState<boolean>(false);
  const [isRadarLoading, setIsRadarLoading] = useState<boolean>(false);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [radarFrameTime, setRadarFrameTime] = useState<string | null>(null);

  // Radar Toggle Handler with Version Tracking to Prevent Race Conditions
  const handleToggleRadar = useCallback(async () => {
    if (isRadarActive) {
      // User turned radar OFF: Immediately detach layer from Leaflet
      setIsRadarActive(false);
      setRadarError(null);
      if (mapInstanceRef.current && radarLayerRef.current) {
        mapInstanceRef.current.removeLayer(radarLayerRef.current);
        radarLayerRef.current = null;
      }
      return;
    }

    // User turned radar ON: Fetch metadata and attach tile layer
    setIsRadarActive(true);
    setIsRadarLoading(true);
    setRadarError(null);
    const currentVersion = ++radarRequestVersionRef.current;

    try {
      const metadata = await getLatestRadarMetadata();

      // Lifecycle safety: Discard if user toggled OFF while loading or unmounted
      if (!isMountedRef.current || radarRequestVersionRef.current !== currentVersion) {
        return;
      }

      if (!mapInstanceRef.current) return;

      // Clean up previous layer instance if any exists
      if (radarLayerRef.current) {
        mapInstanceRef.current.removeLayer(radarLayerRef.current);
        radarLayerRef.current = null;
      }

      // Construct tile layer with verified GIS zoom constraints (maxNativeZoom: 7, maxZoom: 18)
      const tileLayer = L.tileLayer(metadata.tileUrlTemplate, {
        maxNativeZoom: RAINVIEWER_LEAFLET_CONFIG.maxNativeZoom,
        maxZoom: RAINVIEWER_LEAFLET_CONFIG.maxZoom,
        tileSize: RAINVIEWER_LEAFLET_CONFIG.tileSize,
        opacity: RAINVIEWER_LEAFLET_CONFIG.opacity,
        attribution: RAINVIEWER_LEAFLET_CONFIG.attribution,
        zIndex: RAINVIEWER_LEAFLET_CONFIG.zIndex,
      });

      tileLayer.addTo(mapInstanceRef.current);
      radarLayerRef.current = tileLayer;

      // Format observation time (e.g., "12:40 PM")
      const date = new Date(metadata.time * 1000);
      setRadarFrameTime(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      if (!isMountedRef.current || radarRequestVersionRef.current !== currentVersion) {
        return;
      }
      console.warn('RainViewer radar overlay unavailable:', err);
      setRadarError('Radar unavailable');
      setIsRadarActive(false);
    } finally {
      if (isMountedRef.current && radarRequestVersionRef.current === currentVersion) {
        setIsRadarLoading(false);
      }
    }
  }, [isRadarActive]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!mapContainerRef.current) return;

    // Fix default marker icon path issue in Leaflet with webpack/Next.js
    const DefaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
    L.Marker.prototype.options.icon = DefaultIcon;

    const popupText = `
      <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
        <strong style="font-size: 13px;">${locationName}</strong><br/>
        <span>Lat: ${latitude.toFixed(4)}°, Lon: ${longitude.toFixed(4)}°</span><br/>
        <span style="color: #64748b; font-size: 11px;">Source: ${source === 'device' ? 'Device Geolocation' : 'Manual Selection'}</span>
        ${accuracy ? `<br/><span style="color: #0284c7; font-size: 11px;">Accuracy: ±${accuracy} m</span>` : ''}
      </div>
    `;

    // Initialize Map if not already created
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: zoom,
        zoomControl: true,
        scrollWheelZoom: false, // Prevents page scroll trapping
      });

      // Standard OpenStreetMap Base Tile Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      // Marker for active location
      const marker = L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup(popupText);

      // Accuracy circle for device geolocation
      if (accuracy && accuracy > 0) {
        const circle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.15,
          weight: 1.5,
        }).addTo(map);
        accuracyCircleRef.current = circle;
      }

      mapInstanceRef.current = map;
      markerRef.current = marker;
    } else {
      const map = mapInstanceRef.current;
      map.setView([latitude, longitude], zoom, { animate: true });

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
        markerRef.current.setPopupContent(popupText);
      }

      // Update or remove accuracy circle
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }

      if (accuracy && accuracy > 0) {
        const circle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.15,
          weight: 1.5,
        }).addTo(map);
        accuracyCircleRef.current = circle;
      }
    }

    return () => {
      isMountedRef.current = false;
      // Map cleanup on unmount: detach radar layer and remove map
      if (mapInstanceRef.current) {
        if (radarLayerRef.current) {
          mapInstanceRef.current.removeLayer(radarLayerRef.current);
          radarLayerRef.current = null;
        }
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        accuracyCircleRef.current = null;
      }
    };
  }, [latitude, longitude, locationName, accuracy, source, zoom]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* Top Controls Bar: Radar Layer Toggle (Beside Zoom Controls) & Map Synced Badge (Right) */}
      <div className="absolute top-2.5 left-14 right-2.5 z-10 flex items-center justify-between pointer-events-none gap-2">
        {/* Radar Toggle Button */}
        <div className="pointer-events-auto flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleToggleRadar}
            disabled={isRadarLoading}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors cursor-pointer border ${
              isRadarActive
                ? 'bg-sky-50 border-sky-300 text-sky-800 hover:bg-sky-100'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Toggle Live RainViewer Doppler Radar Overlay"
            aria-pressed={isRadarActive}
          >
            <span className="text-sm">📡</span>
            <span>
              {isRadarLoading ? 'Loading Radar…' : isRadarActive ? 'Radar: ON' : 'Radar: OFF'}
            </span>
            {isRadarActive && (
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
            )}
          </button>

          {radarError && (
            <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-800 shadow-2xs">
              ⚠️ {radarError}
            </span>
          )}
        </div>

        {/* Existing Map Synced Badge */}
        <div className="pointer-events-auto shrink-0 flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Map Synced</span>
        </div>
      </div>

      {/* Bottom Floating Cloud Cover & Weather Status HUD */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none max-w-[280px] sm:max-w-xs">
        <div className="pointer-events-auto rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200/90 p-2.5 sm:p-3 shadow-xs text-xs space-y-1">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
            <span className="font-semibold text-slate-800 truncate" title={locationName}>
              📍 {locationName}
            </span>
            <span className="text-[10px] text-slate-500 shrink-0">Point Metric</span>
          </div>

          <div className="flex items-center justify-between text-slate-700">
            <span className="text-slate-600 font-medium">Cloud Cover:</span>
            <span className="font-semibold">
              {typeof cloudCover === 'number' ? `${cloudCover}%` : 'Unavailable'}
            </span>
          </div>

          {conditionDescription && (
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-600 font-medium">Condition:</span>
              <span className="font-semibold text-sky-700 truncate">{conditionDescription}</span>
            </div>
          )}

          {isRadarActive && (
            <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-sky-700">
              <span>Doppler Radar:</span>
              <span className="font-medium">
                {radarFrameTime ? `Live (${radarFrameTime})` : 'Active'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
