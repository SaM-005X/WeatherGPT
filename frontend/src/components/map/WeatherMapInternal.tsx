'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface WeatherMapInternalProps {
  latitude: number;
  longitude: number;
  locationName?: string;
  accuracy?: number;
  source?: 'device' | 'manual';
  zoom?: number;
}

export default function WeatherMapInternal({
  latitude,
  longitude,
  locationName = 'Selected Location',
  accuracy,
  source = 'manual',
  zoom = 11,
}: WeatherMapInternalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
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
      // Map cleanup on unmount
      if (mapInstanceRef.current) {
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
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-2xs">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span>Map Synced</span>
      </div>
    </div>
  );
}
