import { UnitSystem } from '@/types/weather';

/**
 * Converts a temperature value in Celsius to Fahrenheit if unit is imperial.
 * Formula: °F = (°C × 9/5) + 32
 * Keeps the underlying stored value in Celsius.
 */
export function convertTemperature(celsius: number, units: UnitSystem = 'metric'): number {
  if (units === 'imperial') {
    return (celsius * 9) / 5 + 32;
  }
  return celsius;
}

/**
 * Formats a temperature value for display.
 * Returns clean integer string if whole number, or formatted to 1 decimal place (e.g. 19°C -> 66.2°F).
 * Switching back to metric restores the original Celsius value (e.g. 19).
 */
export function formatTemperature(celsius: number, units: UnitSystem = 'metric'): string {
  const value = convertTemperature(celsius, units);
  return Number.isInteger(value) ? value.toString() : Number(value.toFixed(1)).toString();
}

/**
 * Returns the appropriate temperature symbol (°C or °F).
 */
export function getTemperatureSymbol(units: UnitSystem = 'metric'): string {
  return units === 'imperial' ? '°F' : '°C';
}

/**
 * Converts wind speed from km/h to mph when imperial is selected.
 */
export function formatWindSpeed(kmh: number, units: UnitSystem = 'metric'): string {
  if (units === 'imperial') {
    return `${Math.round(kmh * 0.621371)} mph`;
  }
  return `${Math.round(kmh)} km/h`;
}
