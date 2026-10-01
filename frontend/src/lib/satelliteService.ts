/**
 * Dedicated Satellite Imagery Service
 *
 * Provides open, keyless, freely accessible satellite imagery tile layer configurations:
 * 1. Esri World Imagery (Standard high-res global satellite basemap)
 * 2. NASA GIBS MODIS Terra / TrueColor (Live/recent daily satellite imagery)
 *
 * Responsibilities:
 * - Tile URL template construction
 * - Provider metadata & legal attribution strings
 * - GIS maxNativeZoom and maxZoom configuration for Leaflet
 */

export type SatelliteProvider = 'esri_world' | 'nasa_gibs_terra';

export interface SatelliteLayerConfig {
  provider: SatelliteProvider;
  name: string;
  tileUrlTemplate: string;
  attribution: string;
  maxNativeZoom: number;
  maxZoom: number;
  tileSize: number;
  opacity: number;
  zIndex: number;
}

export const SATELLITE_PROVIDERS: Record<SatelliteProvider, Omit<SatelliteLayerConfig, 'tileUrlTemplate'>> = {
  esri_world: {
    provider: 'esri_world',
    name: 'Esri World Imagery',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxNativeZoom: 19,
    maxZoom: 19,
    tileSize: 256,
    opacity: 0.85,
    zIndex: 5,
  },
  nasa_gibs_terra: {
    provider: 'nasa_gibs_terra',
    name: 'NASA GIBS Terra TrueColor',
    attribution:
      'Imagery &copy; <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener noreferrer">NASA Earthdata GIBS</a>',
    maxNativeZoom: 9,
    maxZoom: 18,
    tileSize: 256,
    opacity: 0.85,
    zIndex: 5,
  },
};

/**
 * Builds standard tile URL template for the requested satellite provider.
 */
export function buildSatelliteTileUrlTemplate(
  provider: SatelliteProvider = 'esri_world',
  dateIsoStr?: string
): string {
  if (provider === 'nasa_gibs_terra') {
    // NASA GIBS requires a YYYY-MM-DD date parameter in path
    const date = dateIsoStr ? new Date(dateIsoStr) : new Date();
    // Fall back to yesterday if today's GIBS pass isn't fully processed yet
    date.setDate(date.getDate() - 1);
    const dateFormatted = date.toISOString().split('T')[0];

    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${dateFormatted}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
  }

  // Default: Esri World Imagery
  return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
}

/**
 * Retrieves full Leaflet layer configuration for a satellite provider.
 */
export function getSatelliteLayerConfig(
  provider: SatelliteProvider = 'esri_world',
  dateIsoStr?: string
): SatelliteLayerConfig {
  const meta = SATELLITE_PROVIDERS[provider] || SATELLITE_PROVIDERS.esri_world;
  const tileUrlTemplate = buildSatelliteTileUrlTemplate(provider, dateIsoStr);

  return {
    ...meta,
    tileUrlTemplate,
  };
}
