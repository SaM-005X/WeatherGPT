# WeatherGPT — GraphQL Specification & Application Gateway

## 1. Role of GraphQL & Dual Execution Contexts

**GraphQL is the application's internal API layer.**
- **Internal Contract**: Mediates between frontend user interfaces and internal domain services (`weatherService.ts`, `geocodingService.ts`, `locationPersistenceService.ts`).
- **External Meteorological Source**: The external weather provider is a standard REST API (Open-Meteo REST API). It is **not** required to support GraphQL.
- **Subscriptions**: Real-time GraphQL subscriptions are treated as optional future functionality and are **not** required for the initial release.

### Two Current Execution Contexts (Neither is AppSync)
The repository currently implements GraphQL across two distinct execution contexts:
1. **Local Next.js GraphQL Yoga Route**: Served at `/api/graphql` via `src/app/api/graphql/route.ts` using `graphql-yoga`. Provides local schema execution, resolver verification, and GraphiQL playground in development.
2. **Local AWS Lambda GraphQL Yoga Foundation (Phase 6)**: Implemented in `backend/src/handlers/graphql.ts` behind an API Gateway HTTP API v2 wrapper. Verified offline/locally via integration tests; **not deployed** to AWS.

> **Critical Note on AppSync**: Neither of these existing execution contexts represents the target AWS AppSync architecture. AppSync will be introduced in Phase 8.5 as a fully managed AWS service, replacing the API Gateway + Yoga Lambda layer with direct managed GraphQL routing to domain-grouped Lambda resolvers.

---

## 2. Architecture Transition Path

The application evolves through three explicit architectural states:

### State 1: Completed Client Wiring (Phase 8.5.8 Operational)
```text
Next.js Dashboard
       │
       ▼
fetchWeatherByCoordinates (@/lib/api/graphqlClient)
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[AWS AppSync Endpoint]           [Fallback / Direct]
(Production: x-api-key)          weatherService.ts (Open-Meteo REST)
       │
       ▼
weatherFunction Lambda
       │
       ▼
weatherService.ts (In-memory cache, tiered freshness)
       │
       ▼
Open-Meteo REST API
```
- The dashboard is now wired directly to `fetchWeatherByCoordinates` in `src/lib/api/graphqlClient.ts`.
- In production, it executes typed GraphQL queries against the live AWS AppSync HTTPS endpoint using `NEXT_PUBLIC_APPSYNC_API_KEY`.
- Includes graceful fallback to direct domain service if the cloud endpoint encounters network interruptions, ensuring uninterrupted user experience.

### State 2: Target Local Development (Phase 8.5.8 Wiring)
```text
Next.js Dashboard
       │
       ▼
weatherAdapter.ts
       │
       ▼
graphqlClient.ts
       │
       ▼
GraphQL Yoga Gateway (/api/graphql)
       │
       ▼
weatherService.ts (In-memory cache, tiered freshness)
       │
       ▼
Open-Meteo REST API
```
- In local development, `graphqlClient.ts` targets `/api/graphql`.
- Next.js development remains fully functional offline without AWS credentials.

### State 3: Target AWS Production (Phase 8.5.7+ Deployment)
```text
Next.js Dashboard
       │
       ▼
weatherAdapter.ts
       │
       ▼
graphqlClient.ts
       │
       ▼
AWS AppSync (Managed Serverless GraphQL)
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼
weatherFunction Lambda             locationFunction Lambda            assistantFunction Lambda
(Thin Adapter: Node.js/ARM64)      (Thin Adapter: Node.js/ARM64)      (Thin Adapter — Phase 9)
       │                                 │                                 │
       ▼                                 ▼                                 ▼
weatherService.ts                 geocodingService.ts                LLM Provider
(In-memory cache, deduplication)   locationPersistenceService.ts     (Weather Grounded)
       │                                 │
       ▼                                 ▼
Open-Meteo REST API               Open-Meteo Geocoding / Supabase
```
- AppSync provides the public HTTPS GraphQL endpoint.
- Lambda functions act strictly as thin adapters delegating to the existing domain services.
- `weatherService.ts` retains full ownership of caching, deduplication, and Open-Meteo REST queries.
- Moving the dashboard to this transport requires explicit wiring in Phase 8.5.8; changing environment variables alone does not migrate runtime execution.

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

### Mutation: Ask Weather Assistant (Phase 9 Stub)
```graphql
mutation AskAssistant($message: String!, $coords: CoordinatesInput) {
  askWeatherAssistant(message: $message, coordinates: $coords) {
    reply
    isOffTopic
  }
}
```

---

## 5. Weather Assistant Mutation & Phase 9 Preparation

The GraphQL API already includes the architectural foundation for the Weather Assistant feature planned for Phase 9.

### Current Implemented State (Architectural Stub)
- **SDL Schema (`typeDefs.ts`)**:
  - `type ChatResponse`: Contains `reply: String!` and `isOffTopic: Boolean!`.
  - `askWeatherAssistant(message: String!, coordinates: CoordinatesInput): ChatResponse!`.
- **Resolver Implementation (`weatherResolvers.ts`)**:
  - Validates that `message` is non-empty (returns GraphQL validation error if blank).
  - Returns a structured simulated reply acknowledging coordinates and confirming readiness for Phase 9 AI backend wiring (`isOffTopic: false`).
- **Client Operation Document (`operations.ts`)**:
  - `ASK_WEATHER_ASSISTANT_MUTATION` defined with TypeScript variable types.
- **Frontend UI Preview (`WeatherAssistant.tsx`)**:
  - Interactive chat drawer on the dashboard displaying user/assistant messages and location-aware welcome banner.

### Deferred to Phase 9 (Weather Chatbot Milestone)
The backend does **NOT** currently connect to an LLM. The following pieces constitute the Phase 9 milestone:
- **LLM Provider Integration**: Connecting the `askWeatherAssistant` resolver to an AI provider. (The provider is **not yet finalized**; `LLM_API_KEY` remains a generic contract).
- **Server-Side Meteorological Grounding**: Automatically querying `weatherService.ts` for the supplied `coordinates` and formatting the current temperature, wind, humidity, and forecasts into the system prompt context.
- **Server-Side Guardrail Enforcement**: Validating user intent and setting `isOffTopic: true` if questions stray outside meteorological and weather-planning domains.
- **Frontend Live GraphQL Invocation**: Updating `WeatherAssistant.tsx` to dispatch the GraphQL mutation instead of local mock simulation.
- **Secure Key Provisioning**: Configuring `LLM_API_KEY` in AWS SSM Parameter Store / deployment environments.
- **Deterministic Automated Tests**: Verifying guardrail rejections, weather grounding, and error resilience.

---

## 6. Authentication & Access Control (Phase 8.5 vs Phase 9)

Authentication and authorization requirements differ significantly between public weather operations and AI chatbot execution.

### Phase 8.5 Public Weather Pilot
- **Browser Client Access**: Uses AppSync `API_KEY` for browser-facing public weather queries (`weatherByCoordinates`, `refreshWeather`).
- **Automation / Backend Access**: Uses `AWS_IAM` for trusted backend/worker execution (e.g. background forecast sync).
- **Security Boundaries**:
  - The AppSync API key is **NOT a secret**. It is sent in client request headers (`x-api-key`) and is visible to browser users in network dev tools.
  - The API key must **NEVER** be described as user authentication or access control for sensitive resources; it serves solely as AppSync endpoint authorization and baseline traffic attribution.

### Phase 9 Weather Chatbot Authorization (Unfinalized)
- **Paid Resource Protection**: Unlike weather lookups against keyless Open-Meteo, chatbot requests invoke third-party LLMs that incur real-money API token costs.
- **Abuse Prevention**: Chatbot requests cannot rely solely on a public browser-visible API key. Additional authorization and anti-abuse mechanisms must be evaluated:
  - Supabase Auth / OIDC token verification.
  - AWS Lambda Authorizers validating session tokens.
  - IP-based or session-based rate limiting.
  - CAPTCHA or cryptographic proof-of-work challenges.
- **Selection Deferred**: The specific authorization mechanism remains unfinalized and will be formally evaluated and implemented during Phase 9.

---

## 7. Rollback & Recovery Strategies

### Local Development Rollback
In local development, switching data transport between GraphQL and direct services is instantaneous:
- The GraphQL client can be configured to point to `/api/graphql` or bypassed in favor of direct `weatherService.ts` via local code or configuration toggles.
- Zero cloud teardown or external network operations are required.

### Production AWS Rollback
- **Build Invariant**: Modifying `.env.local` or environment variables locally does **NOT** roll back an already compiled, bundled, and deployed Next.js production build.
- **Deployment Strategy**: Reverting production transport from AppSync back to direct services or a previous release requires a deliberate deployment action:
  - Re-deploying the previous release artifact via the CI/CD pipeline.
  - Edge routing adjustments (e.g., Cloudflare edge rules routing API traffic).
- **Git Recovery Checkpoint**:
  - The verified recovery checkpoint is commit `72990f1` (`chore: checkpoint before AppSync integration`).
  - This commit guarantees a 100% clean, verified pre-AppSync codebase if any fundamental architectural rollback is needed.

