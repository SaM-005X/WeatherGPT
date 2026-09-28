# WeatherGPT — GraphQL Specification & Application Gateway

## 1. Role of GraphQL

**GraphQL is the application's internal API layer.**
- **Frontend / Client**: Issues strongly-typed GraphQL queries and mutations to `/api/graphql` (and in Phase 6, to AWS Lambda via API Gateway).
- **GraphQL Gateway**: Resolvers execute domain operations by delegating directly to `weatherService.ts`, `geocodingService.ts`, and `locationPersistenceService.ts`.
- **External Meteorological Source**: The external weather provider is a standard REST API (Open-Meteo REST API). It is **not** required to support GraphQL.
- **Subscriptions**: Real-time GraphQL subscriptions are treated as optional future functionality and are **not** required for the initial release.

```text
Next.js Frontend (or GraphQL Client)
             ↓ (GraphQL POST/GET)
GraphQL Gateway (/api/graphql via GraphQL Yoga)
             ↓
Domain Services (weatherService.ts, geocodingService.ts, locationPersistenceService.ts)
      ┌──────┴────────────────────────┐
      ▼                               ▼
Open-Meteo REST API          Supabase PostgreSQL (anon key)
```

---

## 2. Implementation Status (Phase 5 Completed)

- **Phase 5 GraphQL Foundation**: **COMPLETED**.
- **Server Implementation**: Built using `graphql-yoga` and standard Web Fetch API in `src/app/api/graphql/route.ts`.
- **Interactive Playground**: GraphiQL interface enabled in development at `http://localhost:3000/api/graphql`.
- **Dashboard Status**: The active dashboard (`src/app/page.tsx`) continues using the proven direct `fetchWeatherData()` domain service for maximum stability.
- **GraphQL Adapter**: `src/graphql/client/weatherAdapter.ts` provides a drop-in `fetchWeatherViaGraphQL()` adapter ready for future migration.
- **Unit Representation**: All weather metrics are normalized and returned strictly in **Celsius**. Display conversions (°C / °F) are handled on the client display layer by `temperature.ts` and `LocationContext`.
- **Future Feature Domains**: Future feature domains (Air Quality, Astronomy, Radar, Hazards) will attach as clean resolvers and types under this established schema.

---

## 3. Implemented GraphQL Schema (SDL)

```graphql
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
```

---

## 4. Example Operations

### Query: Fetch Weather Report
```graphql
query GetWeather($coords: CoordinatesInput!) {
  weatherByCoordinates(coordinates: $coords) {
    locationId
    lastUpdated
    timezone
    current {
      temperature
      feelsLike
      humidity
      windSpeed
      weatherCode
      condition
      conditionDescription
      recordedAt
      isCached
    }
    hourly {
      time
      temperature
      precipitationProbability
      weatherCode
      condition
    }
    daily {
      date
      temperatureMin
      temperatureMax
      precipitationProbability
      weatherCode
      condition
      sunrise
      sunset
    }
  }
}
```

### Mutation: Force Refresh Weather
```graphql
mutation ForceRefresh($coords: CoordinatesInput!) {
  refreshWeather(coordinates: $coords) {
    locationId
    lastUpdated
    current {
      temperature
      isCached
      condition
    }
  }
}
```

### Query: Search Locations (Geocoding)
```graphql
query Search($q: String!, $limit: Int) {
  searchLocations(query: $q, limit: $limit) {
    id
    name
    country
    admin1
    latitude
    longitude
  }
}
```

### Query: Saved Locations (Persistence)
```graphql
query GetSaved($limit: Int) {
  savedLocations(limit: $limit) {
    id
    name
    country
    admin1
    latitude
    longitude
    source
  }
}
```
