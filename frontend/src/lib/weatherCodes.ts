import { WeatherCondition } from '@/types/weather';

export interface WeatherCodeDetails {
  condition: WeatherCondition;
  description: string;
}

/**
 * Standard WMO Weather Interpretation Codes (WW) mapping.
 * Used by Open-Meteo and national weather services worldwide.
 */
const WMO_CODE_MAP: Record<number, WeatherCodeDetails> = {
  0: { condition: 'CLEAR', description: 'Clear sky' },
  1: { condition: 'CLEAR', description: 'Mainly clear' },
  2: { condition: 'PARTLY_CLOUDY', description: 'Partly cloudy' },
  3: { condition: 'OVERCAST', description: 'Overcast' },
  45: { condition: 'FOG', description: 'Fog' },
  48: { condition: 'FOG', description: 'Depositing rime fog' },
  51: { condition: 'DRIZZLE', description: 'Light drizzle' },
  53: { condition: 'DRIZZLE', description: 'Moderate drizzle' },
  55: { condition: 'DRIZZLE', description: 'Dense drizzle' },
  56: { condition: 'DRIZZLE', description: 'Light freezing drizzle' },
  57: { condition: 'DRIZZLE', description: 'Dense freezing drizzle' },
  61: { condition: 'RAIN', description: 'Slight rain' },
  63: { condition: 'RAIN', description: 'Moderate rain' },
  65: { condition: 'HEAVY_RAIN', description: 'Heavy rain' },
  66: { condition: 'RAIN', description: 'Light freezing rain' },
  67: { condition: 'HEAVY_RAIN', description: 'Heavy freezing rain' },
  71: { condition: 'SNOW', description: 'Slight snow fall' },
  73: { condition: 'SNOW', description: 'Moderate snow fall' },
  75: { condition: 'SNOW', description: 'Heavy snow fall' },
  77: { condition: 'SNOW', description: 'Snow grains' },
  80: { condition: 'RAIN', description: 'Slight rain showers' },
  81: { condition: 'RAIN', description: 'Moderate rain showers' },
  82: { condition: 'HEAVY_RAIN', description: 'Violent rain showers' },
  85: { condition: 'SNOW', description: 'Slight snow showers' },
  86: { condition: 'SNOW', description: 'Heavy snow showers' },
  95: { condition: 'THUNDERSTORM', description: 'Thunderstorm' },
  96: { condition: 'THUNDERSTORM', description: 'Thunderstorm with slight hail' },
  99: { condition: 'THUNDERSTORM', description: 'Thunderstorm with heavy hail' },
};

const UNKNOWN_CODE_DETAILS: WeatherCodeDetails = {
  condition: 'UNKNOWN',
  description: 'Unknown conditions',
};

/**
 * Maps a WMO weather code to the application's WeatherCondition enum
 * and a human-readable condition description.
 * Safe fallback is provided for unmapped or invalid codes.
 */
export function mapWmoCode(code: number): WeatherCodeDetails {
  if (typeof code !== 'number' || isNaN(code)) {
    return UNKNOWN_CODE_DETAILS;
  }
  return WMO_CODE_MAP[code] ?? UNKNOWN_CODE_DETAILS;
}
