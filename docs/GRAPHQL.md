# WeatherGPT — GraphQL Specification & Application Gateway

## 1. Role of GraphQL & Execution Contexts

**GraphQL is the application's internal API layer.**
- **Internal Contract**: Mediates between frontend user interfaces and internal domain services (`weatherService.ts`, `geocodingService.ts`, `locationPersistenceService.ts`).
- **External Meteorological Source**: The external weather provider is a standard REST API (Open-Meteo REST API). It is **not** required to support GraphQL.
- **Subscriptions**: Real-time GraphQL subscriptions are treated as optional future functionality and are **not** required for the initial release.

### Three Explicit Execution Contexts

The repository implements GraphQL across three distinct execution contexts:

1. **PRODUCTION — AWS AppSync Managed GraphQL API (Phase 8.5 Implemented & Deployed)**:
   - **Endpoint**: `https://64xz24nnqbdktigtxjwstte234.appsync-api.us-east-1.amazonaws.com/graphql`
   - **API ID**: `lae4htbgzfbcvjnczbgzio3w6q` (Region: `us-east-1`)
   - **Resolver**: Direct Lambda data source resolving `Query.weatherByCoordinates` via `WeatherFunction` (`dist/handlers/appsync.handler`).
   - **Client Integration**: The Next.js frontend calls AppSync via `fetchWeatherByCoordinates` in `src/lib/api/graphqlClient.ts` using `NEXT_PUBLIC_APPSYNC_GRAPHQL_URL` and `NEXT_PUBLIC_APPSYNC_API_KEY`, with automatic fast-failover (< 2ms) to direct domain services if AppSync times out or encounters 5xx errors.
2. **LOCAL — Next.js GraphQL Yoga Route (`/api/graphql`)**:
   - Served at `/api/graphql` via `src/app/api/graphql/route.ts` using `graphql-yoga`.
   - Reuses the identical domain services and schema for local development, offline execution, and schema/resolver verification suites without requiring AWS connectivity.
3. **HISTORICAL FOUNDATION — Phase 6 API Gateway v2 + Yoga Lambda**:
   - Implemented in `backend/src/handlers/graphql.ts` behind an API Gateway HTTP API v2 wrapper and frozen in `backend/serverless.yml`.
   - Served as the offline serverless validation foundation prior to migrating to AWS AppSync as the canonical managed production transport in Phase 8.5.

---

## 2. Production GraphQL Architecture

```text
[ Next.js Frontend Dashboard ]
       │
       ▼
fetchWeatherByCoordinates (@/lib/api/graphqlClient.ts)
       │
       ├────────────────────────────────────────┐
       │ (Primary Production Path: HTTPS POST)  │ (Fast-Fail Overload Fallback < 2ms)
       ▼ [NEXT_PUBLIC_APPSYNC_GRAPHQL_URL]      ▼
[ AWS AppSync (lae4htbgzfbcvjnczbgzio3w6q) ]    direct weatherService.ts
       │ (x-api-key: NEXT_PUBLIC_APPSYNC_API_KEY)  │
       ▼ Direct Lambda Resolver                 ▼
[ WeatherFunction Lambda ] (us-east-1)          Open-Meteo REST API
       │ (Thin Adapter: Node.js 20.x ARM64)
       ▼
weatherService.ts (In-memory 5m cache, tiered freshness)
       │
       ▼
Open-Meteo REST API (https://api.open-meteo.com/v1/forecast)
```

### Exact Production Role of Schema Operations

| Field / Operation | Execution Layer | Active Production Implementation |
| :--- | :--- | :--- |
| **`Query.weatherByCoordinates`** | **AWS AppSync + Lambda** | **Active Production Query**: Resolved by `WeatherFunction` Lambda via `WeatherLambdaDataSource` in AWS AppSync. Fetches and normalizes observations and forecasts. |
| **`Mutation.refreshWeather`** | **Client / AppSync** | **Active**: Handled by passing `{ forceRefresh: true }` through `fetchWeatherByCoordinates`, bypassing caches on the provider query. |
| **`Query.searchLocations`** | **Frontend Domain Service** | **Active on Client**: Handled directly in `src/lib/geocodingService.ts` querying Open-Meteo Geocoding with 30-day Supabase caching. |
| **`Query.savedLocations`** | **Frontend Domain Service** | **Active on Client**: Handled directly in `src/lib/locationPersistenceService.ts` querying Supabase PostgreSQL `public.locations`. |
| **`Mutation.askWeatherAssistant`** | **Architectural Stub (Unused)** | **Unused Schema Stub**: The live chatbot communicates directly with Next.js `/api/chat` (Groq Cloud Qwen 3.8 27B); this GraphQL mutation remains in `schema.graphql` strictly as an architectural contract stub. |

---

## 3. Implemented GraphQL Schema (SDL)

The canonical GraphQL schema (`backend/schema.graphql`) is shared between AWS AppSync and the local GraphQL Yoga route:

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
  cloudCover: Int
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

schema {
  query: Query
  mutation: Mutation
}
```

---

## 4. Query Documents & Operation Specifications

### Query: Weather by Coordinates (Primary AppSync Operation)
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
      cloudCover
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

---

## 5. Chatbot Architecture vs. GraphQL Schema Stub

The schema includes `Mutation.askWeatherAssistant` as an **architectural contract stub**. However, the live production chatbot is **not routed through AppSync or GraphQL**:

1. **Active Chatbot Implementation**:
   - The production Weather Assistant operates via the dedicated Next.js API Route `/api/chat` (`src/app/api/chat/route.ts`).
   - Calls the **Groq Cloud API** running `qwen/qwen3.8-27b` using OpenAI-compatible chat completions.
   - Injecting real-time meteorological JSON context and enforcing balanced lifestyle guardrails directly on the server.
2. **Architectural Separation**:
   - `askWeatherAssistant` remains in `backend/schema.graphql` and `typeDefs.ts` as an architectural stub.
   - It is intentionally not wired to an AWS Lambda resolver in `backend/template.yaml`.
   - This keeps the AppSync backend thin and eliminates unnecessary GraphQL serialization overhead for conversational streaming.

---

## 6. Authentication & Access Control

Authentication and authorization requirements in WeatherGPT are strictly partitioned:

### AppSync Public Weather Operations
- **Browser Client Access**: Uses AppSync `API_KEY` for browser-facing public weather queries (`weatherByCoordinates`).
- **Automation / Backend Access**: Uses `AWS_IAM` for trusted backend execution (e.g. `ForecastSyncFunction`).
- **Security Boundaries**:
  - The AppSync API key (`NEXT_PUBLIC_APPSYNC_API_KEY`) is **NOT a secret**. It is sent in client request headers (`x-api-key`) and is visible to browser users in network developer tools.
  - The API key must **NEVER** be described as user authentication or access control for sensitive resources; it serves solely as AppSync endpoint authorization and baseline traffic attribution.

### Chatbot Secret Isolation
- The chatbot LLM API key (`GROQ_API_KEY`) is a **server-side secret**.
- It is ingested strictly at container runtime by Next.js `/api/chat`.
- It is never prefixed with `NEXT_PUBLIC_`, never exposed to browser bundles, and never stored in Docker build arguments.

---

## 7. Rollback & Failover Strategy

### Automatic Runtime Failover
In production, `fetchWeatherByCoordinates` includes an automatic fast-failover guard:
- If the AppSync request times out (> 8000ms) or returns an HTTP/GraphQL error, the client instantly falls back to direct `weatherService.ts`.
- In the Phase 12 release gate audit (`src/tests/finalEndpointAudit.ts`), this failover operated in **1.58ms** (< 2ms requirement), ensuring zero user-facing downtime.

### Local Development Toggle
In local development, switching data transport between AppSync, `/api/graphql`, and direct services is instantaneous:
- The GraphQL client can be configured via `NEXT_PUBLIC_APPSYNC_GRAPHQL_URL` or bypassed in favor of local `/api/graphql` or direct `weatherService.ts`.
- Zero cloud teardown or external network operations are required.

---

## 8. Related Documentation

- **[Architecture](ARCHITECTURE.md)**: System topology, Mermaid diagrams, and data pipelines.
- **[AWS Serverless](AWS.md)**: CloudFormation template, AppSync, Lambda, and CloudWatch logs.
- **[Deployment Guide](DEPLOYMENT.md)**: Canonical production deployment topology and environment variables.
- **[Troubleshooting Runbook](TROUBLESHOOTING.md)**: AppSync and GraphQL error resolution procedures.
