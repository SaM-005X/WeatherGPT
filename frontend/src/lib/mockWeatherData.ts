/**
 * ISOLATED DEVELOPMENT MOCK DATA
 * 
 * Used strictly for Phase 1 UI structure preview and development testing.
 * Production components do NOT hardcode these values; they receive typed props
 * that will be populated by the GraphQL API in Phase 5.
 */

import { Location } from '@/types/location';
import { CurrentWeather, HourlyForecast, DailyForecast, WeatherReport } from '@/types/weather';

export const MOCK_DEFAULT_LOCATION: Location = {
  id: 'loc-default-london',
  name: 'London',
  country: 'United Kingdom',
  state: 'England',
  latitude: 51.5074,
  longitude: -0.1278,
  source: 'manual',
  timestamp: new Date().toISOString(),
};

export const MOCK_CURRENT_WEATHER: CurrentWeather = {
  temperature: 19,
  feelsLike: 18,
  humidity: 64,
  windSpeed: 14,
  windDirection: 210,
  weatherCode: 2,
  condition: 'PARTLY_CLOUDY',
  conditionDescription: 'Partly Cloudy',
  precipitation: 0.1,
  uvIndex: 4.2,
  pressure: 1016,
  visibility: 10,
  recordedAt: new Date().toISOString(),
  isCached: true,
};

export const MOCK_HOURLY_FORECAST: HourlyForecast[] = [
  { time: '12:00', temperature: 18, precipitationProbability: 10, weatherCode: 1, condition: 'CLEAR', windSpeed: 12, humidity: 60 },
  { time: '13:00', temperature: 19, precipitationProbability: 15, weatherCode: 2, condition: 'PARTLY_CLOUDY', windSpeed: 14, humidity: 58 },
  { time: '14:00', temperature: 20, precipitationProbability: 20, weatherCode: 2, condition: 'PARTLY_CLOUDY', windSpeed: 15, humidity: 55 },
  { time: '15:00', temperature: 20, precipitationProbability: 25, weatherCode: 3, condition: 'OVERCAST', windSpeed: 16, humidity: 56 },
  { time: '16:00', temperature: 19, precipitationProbability: 40, weatherCode: 51, condition: 'DRIZZLE', windSpeed: 15, humidity: 65 },
  { time: '17:00', temperature: 18, precipitationProbability: 60, weatherCode: 61, condition: 'RAIN', windSpeed: 14, humidity: 70 },
  { time: '18:00', temperature: 17, precipitationProbability: 35, weatherCode: 2, condition: 'PARTLY_CLOUDY', windSpeed: 12, humidity: 72 },
  { time: '19:00', temperature: 16, precipitationProbability: 10, weatherCode: 1, condition: 'CLEAR', windSpeed: 10, humidity: 75 },
  { time: '20:00', temperature: 15, precipitationProbability: 5, weatherCode: 1, condition: 'CLEAR', windSpeed: 9, humidity: 78 },
  { time: '21:00', temperature: 14, precipitationProbability: 5, weatherCode: 1, condition: 'CLEAR', windSpeed: 8, humidity: 82 },
];

export const MOCK_DAILY_FORECAST: DailyForecast[] = [
  { date: 'Today', temperatureMin: 12, temperatureMax: 20, precipitationProbability: 40, condition: 'PARTLY_CLOUDY', weatherCode: 2, sunrise: '06:45', sunset: '19:15' },
  { date: 'Fri', temperatureMin: 13, temperatureMax: 21, precipitationProbability: 20, condition: 'CLEAR', weatherCode: 1, sunrise: '06:47', sunset: '19:13' },
  { date: 'Sat', temperatureMin: 14, temperatureMax: 19, precipitationProbability: 65, condition: 'RAIN', weatherCode: 61, sunrise: '06:48', sunset: '19:10' },
  { date: 'Sun', temperatureMin: 11, temperatureMax: 18, precipitationProbability: 30, condition: 'OVERCAST', weatherCode: 3, sunrise: '06:50', sunset: '19:08' },
  { date: 'Mon', temperatureMin: 10, temperatureMax: 17, precipitationProbability: 10, condition: 'CLEAR', weatherCode: 1, sunrise: '06:51', sunset: '19:06' },
  { date: 'Tue', temperatureMin: 12, temperatureMax: 18, precipitationProbability: 25, condition: 'PARTLY_CLOUDY', weatherCode: 2, sunrise: '06:53', sunset: '19:03' },
  { date: 'Wed', temperatureMin: 13, temperatureMax: 19, precipitationProbability: 50, condition: 'DRIZZLE', weatherCode: 51, sunrise: '06:54', sunset: '19:01' },
];

export const MOCK_WEATHER_REPORT: WeatherReport = {
  locationId: MOCK_DEFAULT_LOCATION.id,
  current: MOCK_CURRENT_WEATHER,
  hourly: MOCK_HOURLY_FORECAST,
  daily: MOCK_DAILY_FORECAST,
  lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};
