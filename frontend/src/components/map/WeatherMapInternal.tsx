'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getLatestRadarMetadata,
  RAINVIEWER_LEAFLET_CONFIG,
  RadarMetadata,
  getCloudTileConfig,
} from '@/lib/rainViewerService';
import {
  fetchWindData,
  generateWindArrowSvg,
  generateWindStreamlineSvg,
  WindData,
} from '@/lib/windService';
import {
  getSatelliteLayerConfig,
  SatelliteProvider,
} from '@/lib/satelliteService';
import type { WeatherReport } from '@/types/weather';
import { fetchWeatherData, weatherCache, getCacheKey, getWeatherCacheKey } from '@/lib/weatherService';
import { fetchStormData, StormReport } from '@/lib/stormService';


export interface LayerState {
  radar: boolean;
  wind: boolean;
  clouds: boolean;
  satellite: boolean;
  storms?: boolean;
}

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
  weatherData?: WeatherReport | null;
  isLoading?: boolean;
  onLayerStateChange?: (layers: LayerState) => void;
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
  weatherData,
  isLoading = false,
  onLayerStateChange,
}: WeatherMapInternalProps) {
  // Check client weatherCache synchronously first to eliminate secondary un-memoized network fetches
  const cachedEntry = weatherCache.get(getCacheKey(latitude, longitude)) || weatherCache.get(getWeatherCacheKey(latitude, longitude));
  const cachedCloudCover = cachedEntry?.data?.current?.cloudCover;
  const cachedConditionDesc = cachedEntry?.data?.current?.conditionDescription;

  // Synchronize cloud and weather metrics from direct props, weatherData, or client weatherCache
  const effectiveCloudCover = cloudCover ?? weatherData?.current?.cloudCover ?? cachedCloudCover;
  const effectiveConditionDescription = conditionDescription ?? weatherData?.current?.conditionDescription ?? cachedConditionDesc;

  // Fallback internal fetch only if cloud metrics are completely absent across props, weatherData, and cache
  const [internalCloudCover, setInternalCloudCover] = useState<number | undefined>(cachedCloudCover);
  const [internalConditionDesc, setInternalConditionDesc] = useState<string | undefined>(cachedConditionDesc);

  useEffect(() => {
    // If external/cached cloud metrics are already available or data is currently loading, skip internal fetch
    if (
      cloudCover !== undefined ||
      weatherData?.current?.cloudCover !== undefined ||
      cachedCloudCover !== undefined ||
      isLoading
    ) {
      return;
    }

    let isCancelled = false;
    fetchWeatherData(latitude, longitude)
      .then((report) => {
        if (!isCancelled && report?.current) {
          if (typeof report.current.cloudCover === 'number') {
            setInternalCloudCover(report.current.cloudCover);
          }
          if (report.current.conditionDescription) {
            setInternalConditionDesc(report.current.conditionDescription);
          }
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [latitude, longitude, cloudCover, weatherData, cachedCloudCover, isLoading]);

  const displayCloudCover = effectiveCloudCover ?? internalCloudCover;
  const displayConditionDescription = effectiveConditionDescription ?? internalConditionDesc;


  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  // Layer Refs
  const radarLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const cloudLayerRef = useRef<L.TileLayer | null>(null);
  const windMarkerRef = useRef<L.Marker | null>(null);
  const windGridLayerRef = useRef<L.LayerGroup | null>(null);
  const stormLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const radarRequestVersionRef = useRef<number>(0);

  // Radar Layer & Playback State
  const [isRadarActive, setIsRadarActive] = useState<boolean>(false);
  const [isRadarLoading, setIsRadarLoading] = useState<boolean>(false);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [radarFrameTime, setRadarFrameTime] = useState<string | null>(null);
  const [radarMetadata, setRadarMetadata] = useState<RadarMetadata | null>(null);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [radarOpacity, setRadarOpacity] = useState<number>(RAINVIEWER_LEAFLET_CONFIG.opacity);
  const [isRadarVisible, setIsRadarVisible] = useState<boolean>(true);

  // Wind Layer State
  const [isWindActive, setIsWindActive] = useState<boolean>(false);
  const [windData, setWindData] = useState<WindData | null>(null);

  // Satellite Layer State
  const [isSatelliteActive, setIsSatelliteActive] = useState<boolean>(false);
  const [satelliteOpacity, setSatelliteOpacity] = useState<number>(0.85);
  const [satelliteProvider, setSatelliteProvider] = useState<SatelliteProvider>('esri_world');

  // Cloud Layer State
  const [isCloudActive, setIsCloudActive] = useState<boolean>(false);
  const [cloudOpacity, setCloudOpacity] = useState<number>(0.65);

  // Storms / Lightning Layer State
  const [isStormActive, setIsStormActive] = useState<boolean>(false);
  const [stormData, setStormData] = useState<StormReport | null>(null);

  // Synchronize layer state with parent component
  useEffect(() => {
    onLayerStateChange?.({
      radar: isRadarActive,
      wind: isWindActive,
      clouds: isCloudActive,
      satellite: isSatelliteActive,
      storms: isStormActive,
    });
  }, [isRadarActive, isWindActive, isCloudActive, isSatelliteActive, isStormActive, onLayerStateChange]);

  // ---------------------------------------------------------------------------
  // 1. Doppler Radar Effects & Handlers
  // ---------------------------------------------------------------------------

  // Frame URL swap effect: updates tile layer url smoothly without recreating layer
  useEffect(() => {
    if (!radarLayerRef.current || !radarMetadata || !radarMetadata.frames[currentFrameIdx]) {
      return;
    }
    const frame = radarMetadata.frames[currentFrameIdx];
    radarLayerRef.current.setUrl(frame.tileUrlTemplate);
    setRadarFrameTime(frame.localTime);
  }, [currentFrameIdx, radarMetadata]);

  // Opacity & Layer Visibility effect for Radar
  useEffect(() => {
    if (!radarLayerRef.current) return;
    radarLayerRef.current.setOpacity(isRadarVisible ? radarOpacity : 0);
  }, [radarOpacity, isRadarVisible]);

  // Radar Animation Loop (advances every 850ms when playing)
  useEffect(() => {
    if (!isPlaying || !isRadarActive || !radarMetadata || radarMetadata.frames.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % radarMetadata.frames.length);
    }, 850);

    return () => clearInterval(timer);
  }, [isPlaying, isRadarActive, radarMetadata]);

  // Radar Toggle Handler
  const handleToggleRadar = useCallback(async () => {
    if (isRadarActive) {
      setIsRadarActive(false);
      setIsPlaying(false);
      setRadarMetadata(null);
      setRadarFrameTime(null);
      setRadarError(null);
      if (mapInstanceRef.current && radarLayerRef.current) {
        mapInstanceRef.current.removeLayer(radarLayerRef.current);
        radarLayerRef.current = null;
      }
      return;
    }

    setIsRadarActive(true);
    setIsRadarLoading(true);
    setRadarError(null);
    const currentVersion = ++radarRequestVersionRef.current;

    try {
      const metadata = await getLatestRadarMetadata();

      if (!isMountedRef.current || radarRequestVersionRef.current !== currentVersion) {
        return;
      }

      if (!mapInstanceRef.current) return;

      if (radarLayerRef.current) {
        mapInstanceRef.current.removeLayer(radarLayerRef.current);
        radarLayerRef.current = null;
      }

      const initialFrameIdx = metadata.currentFrameIndex >= 0 ? metadata.currentFrameIndex : 0;
      const initialFrame = metadata.frames[initialFrameIdx] || metadata.frames[0];

      const tileLayer = L.tileLayer(initialFrame.tileUrlTemplate, {
        maxNativeZoom: RAINVIEWER_LEAFLET_CONFIG.maxNativeZoom,
        maxZoom: RAINVIEWER_LEAFLET_CONFIG.maxZoom,
        tileSize: RAINVIEWER_LEAFLET_CONFIG.tileSize,
        opacity: isRadarVisible ? radarOpacity : 0,
        attribution: RAINVIEWER_LEAFLET_CONFIG.attribution,
        zIndex: RAINVIEWER_LEAFLET_CONFIG.zIndex,
      });

      tileLayer.addTo(mapInstanceRef.current);
      radarLayerRef.current = tileLayer;

      setRadarMetadata(metadata);
      setCurrentFrameIdx(initialFrameIdx);
      setRadarFrameTime(initialFrame.localTime);
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
  }, [isRadarActive, isRadarVisible, radarOpacity]);

  // ---------------------------------------------------------------------------
  // 2. Wind Layer & Regional Vector Grid Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let isSubscribed = true;

    if (isWindActive) {
      fetchWindData(latitude, longitude)
        .then((data) => {
          if (isSubscribed) {
            setWindData(data);
          }
        })
        .catch((err) => {
          console.warn('Wind data fetch failed:', err);
        });
    } else {
      if (windMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(windMarkerRef.current);
        windMarkerRef.current = null;
      }
      if (windGridLayerRef.current && mapInstanceRef.current) {
        windGridLayerRef.current.clearLayers();
        mapInstanceRef.current.removeLayer(windGridLayerRef.current);
        windGridLayerRef.current = null;
      }
    }

    return () => {
      isSubscribed = false;
    };
  }, [isWindActive, latitude, longitude]);

  // Generates 5x5 regional grid of animated streamlines across the visible map bounds
  const updateWindGrid = useCallback(() => {
    if (!isWindActive || !windData || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!windGridLayerRef.current) {
      windGridLayerRef.current = L.layerGroup().addTo(map);
    } else {
      windGridLayerRef.current.clearLayers();
    }

    const bounds = map.getBounds();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();

    const latSpan = north - south;
    const lngSpan = east - west;

    let nodeIndex = 0;
    // 5x5 grid across the visible bounds
    for (let r = 1; r <= 5; r++) {
      const nodeLat = south + (latSpan / 6) * r;
      for (let c = 1; c <= 5; c++) {
        const nodeLng = west + (lngSpan / 6) * c;
        nodeIndex++;

        // Don't render streamline directly over the center location badge pin
        const dLat = Math.abs(nodeLat - latitude);
        const dLng = Math.abs(nodeLng - longitude);
        if (dLat < latSpan * 0.08 && dLng < lngSpan * 0.08) {
          continue;
        }

        const svgHtml = generateWindStreamlineSvg(
          windData.directionDegrees,
          windData.speedKmh,
          nodeIndex,
          '#0284c7',
          24
        );

        const streamlineIcon = L.divIcon({
          className: 'wind-streamline-icon',
          html: svgHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([nodeLat, nodeLng], {
          icon: streamlineIcon,
          interactive: false,
          zIndexOffset: 50,
        });

        windGridLayerRef.current.addLayer(marker);
      }
    }
  }, [isWindActive, windData, latitude, longitude]);

  // Render/update center wind marker badge and 5x5 regional grid
  useEffect(() => {
    if (!isWindActive || !windData || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const svgHtml = generateWindArrowSvg(windData.directionDegrees, '#0284c7', 26);
    const customIcon = L.divIcon({
      className: 'custom-wind-marker',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(4px); padding: 3px 6px; border-radius: 8px; border: 1.5px solid #0284c7; box-shadow: 0 2px 6px rgba(0,0,0,0.15); font-family: inherit; text-align: center; cursor: pointer;">
          ${svgHtml}
          <span style="font-size: 10px; font-weight: 700; color: #0369a1; margin-top: 1px; white-space: nowrap;">
            ${windData.cardinalDirection} ${windData.speedKmh} km/h
          </span>
        </div>
      `,
      iconSize: [64, 46],
      iconAnchor: [32, 23],
    });

    if (windMarkerRef.current) {
      windMarkerRef.current.setLatLng([latitude, longitude]);
      windMarkerRef.current.setIcon(customIcon);
    } else {
      windMarkerRef.current = L.marker([latitude, longitude], {
        icon: customIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    }

    // Render regional 5x5 grid and re-render on map move/zoom
    updateWindGrid();
    map.on('moveend', updateWindGrid);

    return () => {
      map.off('moveend', updateWindGrid);
    };
  }, [isWindActive, windData, latitude, longitude, updateWindGrid]);

  // ---------------------------------------------------------------------------
  // 3. Satellite Imagery Layer Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing satellite layer if any
    if (satelliteLayerRef.current) {
      mapInstanceRef.current.removeLayer(satelliteLayerRef.current);
      satelliteLayerRef.current = null;
    }

    if (isSatelliteActive) {
      const config = getSatelliteLayerConfig(satelliteProvider);
      const tileLayer = L.tileLayer(config.tileUrlTemplate, {
        maxNativeZoom: config.maxNativeZoom,
        maxZoom: config.maxZoom,
        tileSize: config.tileSize,
        opacity: satelliteOpacity,
        attribution: config.attribution,
        zIndex: config.zIndex,
      });

      tileLayer.addTo(mapInstanceRef.current);
      satelliteLayerRef.current = tileLayer;
    }
  }, [isSatelliteActive, satelliteProvider, satelliteOpacity]);

  // ---------------------------------------------------------------------------
  // 4. Cloud Visualization Overlay Effects (Live NASA GIBS Cloud Fraction Day)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (!isCloudActive) {
      if (cloudLayerRef.current) {
        mapInstanceRef.current.removeLayer(cloudLayerRef.current);
        cloudLayerRef.current = null;
      }
      return;
    }

    if (!cloudLayerRef.current) {
      const cloudConfig = getCloudTileConfig();
      const tileLayer = L.tileLayer(cloudConfig.urlTemplate, {
        maxNativeZoom: cloudConfig.maxNativeZoom,
        maxZoom: cloudConfig.maxZoom,
        opacity: cloudOpacity,
        attribution: cloudConfig.attribution,
        zIndex: 15,
      });

      tileLayer.addTo(mapInstanceRef.current);
      cloudLayerRef.current = tileLayer;
    } else {
      cloudLayerRef.current.setOpacity(cloudOpacity);
    }
  }, [isCloudActive, cloudOpacity]);

  // ---------------------------------------------------------------------------
  // 5. Leaflet Base Map Initialization & Location Synchronization
  // ---------------------------------------------------------------------------

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
      // Complete Leaflet Layer Teardown to prevent memory leaks
      if (mapInstanceRef.current) {
        if (radarLayerRef.current) {
          mapInstanceRef.current.removeLayer(radarLayerRef.current);
          radarLayerRef.current = null;
        }
        if (satelliteLayerRef.current) {
          mapInstanceRef.current.removeLayer(satelliteLayerRef.current);
          satelliteLayerRef.current = null;
        }
        if (cloudLayerRef.current) {
          mapInstanceRef.current.removeLayer(cloudLayerRef.current);
          cloudLayerRef.current = null;
        }
        if (windMarkerRef.current) {
          mapInstanceRef.current.removeLayer(windMarkerRef.current);
          windMarkerRef.current = null;
        }
        if (windGridLayerRef.current) {
          windGridLayerRef.current.clearLayers();
          mapInstanceRef.current.removeLayer(windGridLayerRef.current);
          windGridLayerRef.current = null;
        }
        if (stormLayerGroupRef.current) {
          stormLayerGroupRef.current.clearLayers();
          mapInstanceRef.current.removeLayer(stormLayerGroupRef.current);
          stormLayerGroupRef.current = null;
        }
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        accuracyCircleRef.current = null;
      }
    };
  }, [latitude, longitude, locationName, accuracy, source, zoom]);

  // ---------------------------------------------------------------------------
  // 5. Thunderstorm & Lightning Tracking Layer Effect
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (!isStormActive) {
      if (stormLayerGroupRef.current) {
        stormLayerGroupRef.current.clearLayers();
        mapInstanceRef.current.removeLayer(stormLayerGroupRef.current);
        stormLayerGroupRef.current = null;
      }
      return;
    }

    if (!stormLayerGroupRef.current) {
      stormLayerGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    let isCancelled = false;

    fetchStormData(latitude, longitude)
      .then((data) => {
        if (isCancelled || !mapInstanceRef.current || !stormLayerGroupRef.current) return;
        setStormData(data);
        stormLayerGroupRef.current.clearLayers();

        // 1. Primary Convective / Storm Marker at Center
        const primaryColor =
          data.convectiveRisk === 'Severe'
            ? '#9333ea'
            : data.convectiveRisk === 'High'
            ? '#e11d48'
            : data.convectiveRisk === 'Moderate'
            ? '#d97706'
            : '#059669';

        const primaryPulse =
          data.convectiveRisk === 'Severe'
            ? 'rgba(147, 51, 234, 0.4)'
            : data.convectiveRisk === 'High'
            ? 'rgba(225, 29, 72, 0.4)'
            : data.convectiveRisk === 'Moderate'
            ? 'rgba(217, 119, 6, 0.4)'
            : 'rgba(5, 150, 105, 0.2)';

        const primaryIcon = L.divIcon({
          className: 'storm-marker-icon',
          html: `
            <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; inset: 0; border-radius: 50%; background: ${primaryPulse}; animation: stormPulse 1.8s infinite ease-out;"></div>
              <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; background: ${primaryColor}; color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.35); border: 2px solid white;">
                ${data.hasActiveThunderstorm ? '⛈️' : data.convectiveRisk === 'None' ? '🛡️' : '⚡'}
              </div>
            </div>
          `,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
          popupAnchor: [0, -19],
        });

        const primaryPopupContent = `
          <div style="min-width: 190px; font-family: sans-serif; font-size: 12px; line-height: 1.4;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px; font-size: 13px;">
              ${data.hasActiveThunderstorm ? '⛈️ ' : '⚡ '}${data.stormType}
            </div>
            <div style="color: #475569; margin-bottom: 2px;">
              Convective Risk: <strong style="color: ${primaryColor};">${data.convectiveRisk}</strong>
            </div>
            <div style="color: #475569; margin-bottom: 2px;">
              Lightning Potential: <strong>${data.lightningPotentialScore}%</strong>
            </div>
            <div style="color: #475569; margin-bottom: 2px;">
              Peak Gusts: <strong>${data.gustsKmh} km/h</strong>
            </div>
            <div style="color: #475569;">
              Precip Rate: <strong>${data.precipitationRate.toFixed(1)} mm/h</strong>
            </div>
          </div>
        `;

        const centerMarker = L.marker([latitude, longitude], { icon: primaryIcon }).bindPopup(primaryPopupContent);
        stormLayerGroupRef.current.addLayer(centerMarker);

        // 2. Regional Convective Storm Cells (if any)
        if (data.stormCells && data.stormCells.length > 0) {
          for (const cell of data.stormCells) {
            const cellColor = cell.intensity === 'severe' ? '#9333ea' : cell.intensity === 'high' ? '#e11d48' : '#d97706';
            const cellPulse = cell.intensity === 'severe' ? 'rgba(147, 51, 234, 0.35)' : 'rgba(225, 29, 72, 0.35)';

            const cellIcon = L.divIcon({
              className: 'storm-cell-icon',
              html: `
                <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                  <div style="position: absolute; inset: 0; border-radius: 50%; background: ${cellPulse}; animation: stormPulse 1.4s infinite ease-out;"></div>
                  <div style="position: relative; width: 24px; height: 24px; border-radius: 50%; background: ${cellColor}; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 2px solid white;">
                    ⛈️
                  </div>
                </div>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
              popupAnchor: [0, -16],
            });

            const cellPopup = `
              <div style="font-family: sans-serif; font-size: 11px; line-height: 1.3;">
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${cell.description}</div>
                <div style="color: #475569;">Distance: ${cell.distanceKm} km (${cell.directionCardinal})</div>
                <div style="color: #475569;">Intensity: <strong>${cell.intensity.toUpperCase()}</strong></div>
              </div>
            `;

            const cellMarker = L.marker([cell.lat, cell.lon], { icon: cellIcon }).bindPopup(cellPopup);
            stormLayerGroupRef.current.addLayer(cellMarker);
          }
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [isStormActive, latitude, longitude]);

  // Cloud coverage description helper
  const getCloudCategory = (cover?: number) => {
    if (cover === undefined) return 'Unavailable';
    if (cover < 20) return 'Clear (0-19%)';
    if (cover < 60) return 'Partly Cloudy (20-59%)';
    if (cover < 85) return 'Mostly Cloudy (60-84%)';
    return 'Overcast (85-100%)';
  };

  // Estimated Cloud Base Altitude (in meters)
  const getEstimatedCloudBase = (cover?: number) => {
    if (cover === undefined) return 'N/A';
    if (cover < 20) return '> 3,500 m (High Cirrus)';
    if (cover < 60) return '~ 2,200 m (Cumulus Base)';
    if (cover < 85) return '~ 1,400 m (Altostratus)';
    return '~ 800 m (Low Stratus)';
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* Top Map Controls Bar: Layer Selection Buttons */}
      <div className="absolute top-2.5 left-14 right-2.5 z-10 flex items-center justify-between pointer-events-none gap-2">
        {/* Layer Buttons Group */}
        <div className="pointer-events-auto flex items-center gap-1.5 flex-wrap">
          {/* Radar Toggle Button */}
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
            <span>📡</span>
            <span>{isRadarLoading ? 'Radar…' : 'Radar'}</span>
            {isRadarActive && <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />}
          </button>

          {/* Wind Layer Toggle Button */}
          <button
            type="button"
            onClick={() => setIsWindActive((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors cursor-pointer border ${
              isWindActive
                ? 'bg-sky-50 border-sky-300 text-sky-800 hover:bg-sky-100'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Toggle Wind HUD Badge and Vector Arrow Marker"
            aria-pressed={isWindActive}
          >
            <span>🌬️</span>
            <span>Wind</span>
            {isWindActive && <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />}
          </button>

          {/* Cloud Layer Toggle Button */}
          <button
            type="button"
            onClick={() => setIsCloudActive((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors cursor-pointer border ${
              isCloudActive
                ? 'bg-sky-50 border-sky-300 text-sky-800 hover:bg-sky-100'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Toggle Cloud Metrics & Visualization Overlay"
            aria-pressed={isCloudActive}
          >
            <span>☁️</span>
            <span>Clouds</span>
            {isCloudActive && <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />}
          </button>

          {/* Satellite Layer Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSatelliteActive((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors cursor-pointer border ${
              isSatelliteActive
                ? 'bg-sky-50 border-sky-300 text-sky-800 hover:bg-sky-100'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Toggle Satellite Imagery Tiles (Esri / NASA GIBS)"
            aria-pressed={isSatelliteActive}
          >
            <span>🛰️</span>
            <span>Satellite</span>
            {isSatelliteActive && <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />}
          </button>

          {/* Storms / Lightning Layer Toggle Button */}
          <button
            type="button"
            onClick={() => setIsStormActive((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors cursor-pointer border ${
              isStormActive
                ? 'bg-purple-50 border-purple-300 text-purple-800 hover:bg-purple-100'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Toggle Thunderstorm & Lightning Tracking Layer"
            aria-pressed={isStormActive}
          >
            <span>⚡</span>
            <span>Storms</span>
            {isStormActive && <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />}
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

      {/* Satellite Layer Controls Bar (Appears when Satellite is ON) */}
      {isSatelliteActive && (
        <div className="absolute top-12 left-14 z-10 pointer-events-auto bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-md p-2 shadow-xs text-xs flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-700">Source:</span>
            <select
              value={satelliteProvider}
              onChange={(e) => setSatelliteProvider(e.target.value as SatelliteProvider)}
              className="rounded bg-slate-100 border border-slate-300 text-slate-800 px-1.5 py-0.5 text-[11px] font-medium cursor-pointer"
            >
              <option value="esri_world">Esri World Imagery</option>
              <option value="nasa_gibs_terra">NASA GIBS Terra</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">Opacity:</span>
            <input
              type="range"
              min={0.2}
              max={1.0}
              step={0.05}
              value={satelliteOpacity}
              onChange={(e) => setSatelliteOpacity(Number(e.target.value))}
              className="w-16 accent-sky-600 h-1 bg-slate-200 rounded cursor-pointer"
            />
            <span className="font-mono text-[10px] w-6">{Math.round(satelliteOpacity * 100)}%</span>
          </div>
        </div>
      )}

      {/* Cloud Layer Opacity Control Bar (Appears when Clouds is ON) */}
      {isCloudActive && !isSatelliteActive && (
        <div className="absolute top-12 left-14 z-10 pointer-events-auto bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-md p-2 shadow-xs text-xs flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Cloud Opacity:</span>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={cloudOpacity}
              onChange={(e) => setCloudOpacity(Number(e.target.value))}
              className="w-20 accent-sky-600 h-1 bg-slate-200 rounded cursor-pointer"
            />
            <span className="font-mono text-[10px] w-6">{Math.round(cloudOpacity * 100)}%</span>
          </div>
          <span className="text-[10px] text-slate-500 border-l border-slate-200 pl-2">
            NASA GIBS Live
          </span>
        </div>
      )}

      {/* Bottom Floating Cloud & Weather Metric HUD */}
      <div
        className={`absolute bottom-3 left-3 z-10 pointer-events-none max-w-[280px] sm:max-w-xs ${
          isRadarActive ? 'hidden sm:block' : 'block'
        }`}
      >
        <div className="pointer-events-auto rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200/90 p-2.5 sm:p-3 shadow-xs text-xs space-y-1">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
            <span className="font-semibold text-slate-800 truncate" title={locationName}>
              📍 {locationName}
            </span>
            <span className="text-[10px] text-slate-500 shrink-0">Point Metric</span>
          </div>

          <div className="flex items-center justify-between text-slate-700">
            <span className="text-slate-600 font-medium">Cloud Cover:</span>
            {isLoading ? (
              <span className="inline-block h-3.5 w-12 rounded bg-slate-200 animate-pulse" />
            ) : (
              <span className="font-semibold">
                {typeof displayCloudCover === 'number' ? `${displayCloudCover}%` : 'Unavailable'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-slate-700">
            <span className="text-slate-600 font-medium">Cloud Category:</span>
            {isLoading ? (
              <span className="inline-block h-3.5 w-24 rounded bg-slate-200 animate-pulse" />
            ) : (
              <span className="font-medium text-slate-800">{getCloudCategory(displayCloudCover)}</span>
            )}
          </div>

          <div className="flex items-center justify-between text-slate-700">
            <span className="text-slate-600 font-medium">Cloud Base:</span>
            {isLoading ? (
              <span className="inline-block h-3.5 w-20 rounded bg-slate-200 animate-pulse" />
            ) : (
              <span className="font-medium text-slate-700">{getEstimatedCloudBase(displayCloudCover)}</span>
            )}
          </div>

          {(displayConditionDescription || isLoading) && (
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-600 font-medium">Condition:</span>
              {isLoading ? (
                <span className="inline-block h-3.5 w-16 rounded bg-slate-200 animate-pulse" />
              ) : (
                <span className="font-semibold text-sky-700 truncate">{displayConditionDescription}</span>
              )}
            </div>
          )}

          {/* Wind HUD Row (Appears when Wind is active or data available) */}
          {isWindActive && windData && (
            <div className="pt-1 border-t border-slate-100 space-y-0.5">
              <div className="flex items-center justify-between text-[11px] text-sky-900 font-bold">
                <span>🌬️ Wind Velocity:</span>
                <span>
                  {windData.cardinalDirection} {windData.speedKmh} km/h ({windData.speedMph} mph)
                </span>
              </div>
              {windData.gustsKmh !== undefined && (
                <div className="flex items-center justify-between text-[10px] text-slate-600">
                  <span>Peak Gusts:</span>
                  <span>{windData.gustsKmh} km/h ({windData.gustsMph} mph)</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[10px] text-slate-600">
                <span>Beaufort Scale:</span>
                <span className="font-medium text-slate-800">
                  Bft {windData.beaufortScale} ({windData.beaufortDescription})
                </span>
              </div>
            </div>
          )}

          {/* Storms HUD Row (Appears when Storms layer is active) */}
          {isStormActive && stormData && (
            <div className="pt-1 border-t border-slate-100 space-y-0.5">
              <div className="flex items-center justify-between text-[11px] text-purple-900 font-bold">
                <span>⚡ Convective Risk:</span>
                <span className="uppercase">{stormData.convectiveRisk}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-600">
                <span>Lightning Potential:</span>
                <span className="font-semibold">{stormData.lightningPotentialScore}%</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-600">
                <span>Convective Squalls:</span>
                <span>{stormData.gustsKmh} km/h</span>
              </div>
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

      {/* Radar Timeline Playback Controller Dock */}
      {isRadarActive && radarMetadata && radarMetadata.frames.length > 0 && (
        <div className="absolute bottom-3 right-3 left-3 sm:left-auto z-10 max-w-full sm:max-w-[340px] pointer-events-auto">
          <div className="rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200/90 p-2.5 sm:p-3 shadow-md text-xs space-y-2">
            {/* Top row: Frame category, Step counter & Timestamps (Local + UTC) */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-slate-800 truncate">
                  {radarMetadata.frames[currentFrameIdx]?.type === 'nowcast' ? '🔮 Nowcast' : '📡 Past Radar'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                    radarMetadata.frames[currentFrameIdx]?.type === 'nowcast'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-sky-100 text-sky-700'
                  }`}
                >
                  Frame {currentFrameIdx + 1}/{radarMetadata.frames.length}
                </span>
              </div>

              <div className="text-[11px] font-mono text-slate-700 font-medium shrink-0">
                <span>{radarMetadata.frames[currentFrameIdx]?.localTime}</span>
                <span className="text-[10px] text-slate-400 ml-1">
                  ({new Date(radarMetadata.frames[currentFrameIdx].time * 1000).toUTCString().slice(17, 22)} UTC)
                </span>
              </div>
            </div>

            {/* Middle row: Timeline controls (Play/Pause, Step Back, Scrubber, Step Next) */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-7 w-7 shrink-0 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
                title={isPlaying ? 'Pause Radar Loop' : 'Play Radar Loop'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentFrameIdx(
                    (prev) => (prev - 1 + radarMetadata.frames.length) % radarMetadata.frames.length
                  );
                }}
                className="h-7 w-7 shrink-0 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                title="Previous Frame (-10 min)"
                aria-label="Previous Frame"
              >
                ⏮️
              </button>

              <input
                type="range"
                min={0}
                max={radarMetadata.frames.length - 1}
                value={currentFrameIdx}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentFrameIdx(Number(e.target.value));
                }}
                className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                aria-label="Radar frame timeline scrubber"
              />

              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentFrameIdx((prev) => (prev + 1) % radarMetadata.frames.length);
                }}
                className="h-7 w-7 shrink-0 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                title="Next Frame (+10 min)"
                aria-label="Next Frame"
              >
                ⏭️
              </button>
            </div>

            {/* Bottom row: Opacity Slider & Show/Hide Layer Toggle */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <span title="Radar Layer Opacity">Opacity:</span>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={radarOpacity}
                  onChange={(e) => setRadarOpacity(Number(e.target.value))}
                  className="w-16 accent-sky-600 h-1 bg-slate-200 rounded cursor-pointer"
                  aria-label="Radar layer opacity slider"
                />
                <span className="font-mono text-[10px] w-7">{Math.round(radarOpacity * 100)}%</span>
              </div>

              <button
                type="button"
                onClick={() => setIsRadarVisible(!isRadarVisible)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition cursor-pointer ${
                  isRadarVisible
                    ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                    : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                }`}
                title={isRadarVisible ? 'Hide radar layer from map' : 'Show radar layer on map'}
                aria-pressed={isRadarVisible}
              >
                {isRadarVisible ? '👁️ Visible' : '🙈 Hidden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded CSS animation for wind vector and storm cell pulse flow */}
      <style>{`
        @keyframes windVectorPulse {
          0%, 100% {
            opacity: 0.35;
            transform: scale(0.85);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.15);
          }
        }
        @keyframes stormPulse {
          0% {
            transform: scale(0.8);
            opacity: 0.85;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
