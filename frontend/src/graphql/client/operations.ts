/**
 * GraphQL Client Operation Documents
 *
 * Strongly-typed GraphQL query and mutation documents used by the client.
 */

export const GET_WEATHER_BY_COORDINATES = /* GraphQL */ `
  query GetWeatherByCoordinates($coordinates: CoordinatesInput!) {
    weatherByCoordinates(coordinates: $coordinates) {
      locationId
      lastUpdated
      timezone
      current {
        temperature
        feelsLike
        humidity
        windSpeed
        windDirection
        weatherCode
        condition
        conditionDescription
        precipitation
        uvIndex
        pressure
        visibility
        recordedAt
        isCached
      }
      hourly {
        time
        temperature
        precipitationProbability
        weatherCode
        condition
        windSpeed
        humidity
      }
      daily {
        date
        temperatureMin
        temperatureMax
        precipitationProbability
        precipitationSum
        weatherCode
        condition
        sunrise
        sunset
      }
    }
  }
`;

export const REFRESH_WEATHER_MUTATION = /* GraphQL */ `
  mutation RefreshWeather($coordinates: CoordinatesInput!) {
    refreshWeather(coordinates: $coordinates) {
      locationId
      lastUpdated
      timezone
      current {
        temperature
        feelsLike
        humidity
        windSpeed
        windDirection
        weatherCode
        condition
        conditionDescription
        precipitation
        uvIndex
        pressure
        visibility
        recordedAt
        isCached
      }
      hourly {
        time
        temperature
        precipitationProbability
        weatherCode
        condition
        windSpeed
        humidity
      }
      daily {
        date
        temperatureMin
        temperatureMax
        precipitationProbability
        precipitationSum
        weatherCode
        condition
        sunrise
        sunset
      }
    }
  }
`;

export const SEARCH_LOCATIONS_QUERY = /* GraphQL */ `
  query SearchLocations($query: String!, $limit: Int) {
    searchLocations(query: $query, limit: $limit) {
      id
      name
      country
      admin1
      latitude
      longitude
      timezone
      source
    }
  }
`;

export const SAVED_LOCATIONS_QUERY = /* GraphQL */ `
  query SavedLocations($limit: Int) {
    savedLocations(limit: $limit) {
      id
      name
      country
      admin1
      latitude
      longitude
      timezone
      source
    }
  }
`;

export const ASK_WEATHER_ASSISTANT_MUTATION = /* GraphQL */ `
  mutation AskWeatherAssistant($message: String!, $coordinates: CoordinatesInput) {
    askWeatherAssistant(message: $message, coordinates: $coordinates) {
      reply
      isOffTopic
    }
  }
`;
