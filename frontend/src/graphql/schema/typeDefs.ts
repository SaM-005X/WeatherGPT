/**
 * GraphQL Schema Definition (SDL)
 *
 * Defines the strongly-typed contract for WeatherGPT's internal GraphQL API layer.
 * All weather temperatures are normalized and returned strictly in Celsius.
 */

export const typeDefs = /* GraphQL */ `
  """
  Geographical coordinates input.
  """
  input CoordinatesInput {
    latitude: Float!
    longitude: Float!
  }

  """
  Standardized weather condition classifications mapped from WMO codes.
  """
  enum WeatherCondition {
    CLEAR
    PARTLY_CLOUDY
    OVERCAST
    FOG
    DRIZZLE
    RAIN
    HEAVY_RAIN
    SNOW
    THUNDERSTORM
    UNKNOWN
  }

  """
  Geographic location entity matching the active location model.
  """
  type Location {
    id: ID!
    name: String!
    country: String
    admin1: String
    latitude: Float!
    longitude: Float!
    timezone: String
    source: String
  }

  """
  Current real-time weather observations. All temperatures are in Celsius.
  """
  type CurrentWeather {
    temperature: Float!
    feelsLike: Float!
    humidity: Int!
    windSpeed: Float!
    windDirection: Int!
    weatherCode: Int!
    condition: WeatherCondition!
    conditionDescription: String!
    precipitation: Float
    uvIndex: Float
    pressure: Float
    visibility: Float
    recordedAt: String!
    isCached: Boolean
  }

  """
  Hourly projection (24-hour horizon). Temperature is in Celsius.
  """
  type HourlyForecast {
    time: String!
    temperature: Float!
    precipitationProbability: Int!
    weatherCode: Int!
    condition: WeatherCondition!
    windSpeed: Float
    humidity: Int
  }

  """
  Daily forecast projection (up to 7 days). Temperatures are in Celsius.
  """
  type DailyForecast {
    date: String!
    temperatureMin: Float!
    temperatureMax: Float!
    precipitationProbability: Int!
    precipitationSum: Float
    weatherCode: Int!
    condition: WeatherCondition!
    sunrise: String
    sunset: String
  }

  """
  Aggregated weather bundle containing location ID, current weather, and forecasts.
  """
  type WeatherReport {
    locationId: String!
    current: CurrentWeather!
    hourly: [HourlyForecast!]!
    daily: [DailyForecast!]!
    lastUpdated: String!
    timezone: String
  }

  """
  Response stub from the weather assistant contract.
  """
  type ChatResponse {
    reply: String!
    isOffTopic: Boolean!
  }

  type Query {
    """
    Retrieve weather for coordinates. Returns normalized Celsius observations & forecasts.
    Checks 5-minute memory cache before calling external REST provider.
    """
    weatherByCoordinates(coordinates: CoordinatesInput!): WeatherReport!

    """
    Search for locations by place name or coordinates query string.
    """
    searchLocations(query: String!, limit: Int = 5): [Location!]!

    """
    Retrieve recently saved locations from persistence layer.
    """
    savedLocations(limit: Int = 5): [Location!]!
  }

  type Mutation {
    """
    Manually trigger a fresh weather fetch from Open-Meteo REST API, bypassing the cache.
    """
    refreshWeather(coordinates: CoordinatesInput!): WeatherReport!

    """
    Architectural stub for weather assistant API contract.
    """
    askWeatherAssistant(
      message: String!
      coordinates: CoordinatesInput
    ): ChatResponse!
  }
`;
