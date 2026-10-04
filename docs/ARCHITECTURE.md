# WeatherGPT — System Architecture

## 1. Architectural Principles

1. **Simplicity Over Complexity**: Minimal moving parts, avoiding Kubernetes, microservices, or complex spatial pipelines.
2. **Single Source of Truth for Location**: The frontend maintains one active location state in `LocationContext` consumed by the header, navigation modal, location cards, map, and weather domain services.
3. **Provider-Agnostic Domain Services**: `weatherService.ts` encapsulates meteorological requests and normalizes them into clean Celsius domain models. External weather providers use standard REST (Open-Meteo).
4. **Deterministic In-Memory Caching & Freshness**: Tiered freshness windows (5m current, 30m hourly, 2h daily, 24h stale fallback) with in-flight request deduplication and non-destructive UI updates.
5. **Clear Application Boundaries & Domain Service Ownership**: The active dashboard currently operates on direct `weatherService.ts` with zero disruption. GraphQL Yoga exists at `/api/graphql` for local execution and testing. AWS AppSync is the planned managed GraphQL transport for AWS production. Domain services (`weatherService.ts`, `geocodingService.ts`, `locationPersistenceService.ts`) remain the single source of truth for business logic; Lambda handlers act strictly as thin adapters.
6. **Relational Persistence (Current Implementation)**: Supabase PostgreSQL stores user-selected locations (`public.locations`) and caches 30-day geocoding search queries (`public.geocoding_cache`) with Row Level Security.
7. **Serverless on AWS (Local Foundation / AppSync IaC Canonicalization)**: The Phase 6 serverless foundation (`backend/` with Lambda, API Gateway v2, EventBridge, CloudWatch) was verified locally; actual cloud provisioning remains deferred. For Phase 8.5 AppSync, AWS SAM (`backend/template.yaml`) is the single canonical IaC definition, while `backend/serverless.yml` remains frozen at the Phase 6 foundation.
8. **Focused Weather Chatbot (Partially Implemented Preview / Future Phase 9 AI)**: Simple weather-topic guardrail ensuring the assistant only answers weather questions using trusted data. The frontend UI preview and typed GraphQL contract stub exist today; real LLM integration and server-side guardrail enforcement are planned for Phase 9.
9. **Interactive Mapping & Doppler Radar (Implemented in Phase 8)**: Keyless Leaflet mapping, live RainViewer Doppler radar tile overlay with lifecycle management, real-time Cloud Cover HUD, and multi-instance coordinate synchronization.

---

## 2. Location System Architecture (Implemented in Phase 2)

```text
                           [ User Interaction ]
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
    ["Use My Location" Click]               [Manual Input / Preset]
               │                                       │
               ▼                                       ▼
    navigator.geolocation                   findMatchingPreset / Coord Regex
    (Single-shot, Accuracy in m)            (Instant fallback / Lookup)
               │                                       │
               └───────────────────┬───────────────────┘
                                   │
                                   ▼
                       [ useLocationSystem Hook ]
                     (Single Source of Truth State)
                                   │
            ┌──────────────────────┼──────────────────────┐
            ▼                      ▼                      ▼
       [ Header ]         [ LocationSection ]      [ WeatherMap ]
    (Badge & Source)      (Active Details & GPS)   (Center, Marker, Circle)
            │                      │                      │
            └──────────────────────┴──────────────────────┘
                                   │
                                   ▼
                   [ Future GraphQL Query Input ]
                  currentWeather(latitude, longitude)
```

### Location Model Specifications
The location model (`src/types/location.ts`) is designed to map directly to future GraphQL query inputs:
- `id`: Unique identifier string.
- `name`: Display name (e.g. "Current Location", "Kolkata", "London").
- `country`: Optional country name.
- `latitude`: Precise numeric latitude (-90 to +90).
- `longitude`: Precise numeric longitude (-180 to +180).
- `accuracy`: Optional numeric accuracy in meters (captured from device GPS).
- `source`: `'device' | 'manual'` (delineates GPS vs. manual query).
- `timestamp`: ISO string of when location was resolved.

### Browser Geolocation Behavior
- **Trigger**: Strictly user-initiated upon clicking the "Use My Location" button.
- **Tracking**: Single-shot query (`navigator.geolocation.getCurrentPosition`). Continuous tracking (`watchPosition`) is strictly prohibited to respect user privacy and battery life.
- **Accuracy**: Captures `position.coords.accuracy` in meters.
- **Error Mapping**:
  - `PERMISSION_DENIED`: "Location access was denied. You can select a location manually or pick a preset city."
  - `POSITION_UNAVAILABLE`: "Your device location is currently unavailable. Please verify your connection or select a city manually."
  - `TIMEOUT`: "Location request timed out. Please try again or select a city manually."
  - `UNSUPPORTED`: "Geolocation is not supported by your current browser. You can select a city manually."

### Map Synchronization
- The Leaflet map component dynamically consumes `activeLocation`.
- Whenever `latitude` or `longitude` updates, the map centers smoothly on the new coordinates (`map.setView([lat, lon], zoom)`).
- Marker popup updates to show location name, coordinates, source, and accuracy.
- When `accuracy` is present (from device geolocation), an accuracy radius circle (`L.circle`) is rendered around the marker. When manual location is selected, the accuracy circle is removed cleanly.

---

## 2.1 Frontend Stabilization & Theme Design System (Phase 2.1)

### Temperature Conversion Architecture
- Centralized utility `src/lib/temperature.ts` provides uniform temperature and wind speed conversions:
  - **Conversion Formula**: `°F = (°C × 9/5) + 32`
  - **Reversibility**: Underlying mock/preview weather data remains strictly in Celsius. Switching units never mutates source data.
  - **Precision**: Formats whole numbers as clean integers (e.g. 20°C -> 68°F) and fractional conversions to 1 decimal place (e.g. 19°C -> 66.2°F).
  - **Scope**: Applied consistently across `CurrentWeatherCard`, `HourlyForecastList`, and `DailyForecastList`.

### Light Theme Design System
- Transformed from dark navy "AI dashboard" styling to a natural, human-designed light weather-app aesthetic:
  - **Background**: Soft neutral canvas (`#f8fafc` / Tailwind `bg-slate-50`).
  - **Surfaces**: Crisp white cards (`bg-white`) with subtle borders (`border-slate-200`) and minimal shadows (`shadow-xs`).
  - **Typography**: Dark high-contrast primary text (`text-slate-900`) with muted gray secondary text (`text-slate-500`).
  - **Accents**: Restrained sky-blue (`bg-sky-600`, `text-sky-600`) without neon glows or heavy gradients.
  - **Form Controls**: High-legibility input fields with explicit focus rings (`focus:ring-2 focus:ring-sky-100 focus:border-sky-500`).

### Hydration Stabilization
- Formatted timestamps in `CurrentWeatherCard.tsx` and `WeatherAssistant.tsx` are hardened with `suppressHydrationWarning` and deterministic formatting to avoid server/client locale hydration mismatch.
- Weather data remains strictly isolated mock preview data; live weather API integration has **NOT** started.

---

## 3. End-to-End System Architecture

### A. Current Implemented Architecture (Active Runtime)

The active dashboard (`src/app/page.tsx`) currently queries meteorological data by calling `weatherService.ts` directly.

```text
Next.js Dashboard
       │
       ▼
weatherService.ts (In-memory 5m cache, tiered freshness, deduplication)
       │
       ▼
Open-Meteo REST API (https://api.open-meteo.com/v1/forecast)
```

**Key Characteristics of Current State:**
- **Dashboard Data Transport**: Operates entirely on direct `weatherService.ts` with zero GraphQL runtime dependency.
- **Local GraphQL Gateway**: A fully functional GraphQL Yoga engine exists at `/api/graphql` (`src/app/api/graphql/route.ts`). It reuses the same domain services and schema for schema/resolver testing and local development, but is not currently in the dashboard's render path.
- **AWS Backend Foundation (Phase 6)**: The AWS Lambda and API Gateway v2 handlers (`backend/src/handlers/graphql.ts`, `sync.ts`) exist and have been tested offline/locally, but are **not deployed** to AWS.
- **Persistent Data**: Supabase PostgreSQL is actively queried for saved locations (`public.locations`) and geocoding cache (`public.geocoding_cache`) using the public `anon` key.
- **Radar & Geospatial**: Interactive Leaflet maps (`WeatherMap.tsx`, `/maps`) query RainViewer Doppler radar tiles and Open-Meteo cloud cover directly.

---

### B. Future Local GraphQL Architecture (Target Local Development)

During Phase 8.5.8, the frontend client will be wired to consume GraphQL via `weatherAdapter.ts` and `graphqlClient.ts`. In local development, requests route to the Next.js App Router GraphQL Yoga route:

```text
Next.js Dashboard
       │
       ▼
weatherAdapter.ts (Drop-in adapter matching fetchWeatherData signature)
       │
       ▼
graphqlClient.ts (Lightweight typed fetch-based client)
       │
       ▼
GraphQL Yoga Gateway (/api/graphql)
       │
       ▼
weatherService.ts (Domain business logic & in-memory cache)
       │
       ▼
Open-Meteo REST API
```

---

### C. Future AWS AppSync Architecture (Target AWS Production)

In production AWS deployment, AWS AppSync serves as the fully managed serverless GraphQL entry point:

```text
Next.js Dashboard (Static / Edge Deployed)
       │
       ▼
weatherAdapter.ts
       │
       ▼
graphqlClient.ts (Configured with AppSync HTTPS endpoint + x-api-key / IAM)
       │
       ▼
AWS AppSync (Managed Serverless GraphQL Transport)
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼
weatherFunction Lambda             locationFunction Lambda            assistantFunction Lambda
(Thin Adapter: Node.js/ARM64)      (Thin Adapter: Node.js/ARM64)      (Thin Adapter — Phase 9)
       │                                 │                                 │
       ▼                                 ▼                                 ▼
weatherService.ts                 geocodingService.ts                LLM Provider API
(In-memory cache, deduplication)   locationPersistenceService.ts     (Grounded with live weather)
       │                                 │
       ▼                                 ▼
Open-Meteo REST API               Open-Meteo Geocoding / Supabase
```

---

### D. Domain Services Remain the Business Logic Layer

A central architectural mandate of WeatherGPT is that **AppSync and Lambda handlers must NOT become the main business-logic layer**:
- **Domain Service Authority**: `weatherService.ts`, `geocodingService.ts`, `locationPersistenceService.ts`, and `rainViewerService.ts` remain the single source of truth for all calculations, validations, caching rules, and external provider coordination.
- **Thin Lambda Adapters**: Lambda functions act strictly as thin adapters:
  1. Receive the AppSync resolver event (e.g., `event.arguments.coordinates`).
  2. Invoke the corresponding domain service method.
  3. Return the normalized domain model to AppSync.
- **Transport Independence**: Business logic remains 100% testable and runnable offline without AWS, AppSync, or cloud connectivity.

---

### System Topology Diagram (Target Overview)

```mermaid
flowchart TD
    UserClient["User Browser / Client"] -->|"HTTPS"| Cloudflare["Cloudflare (Target: DNS / Full Strict SSL / CDN)"]
    
    subgraph FrontendApp["Frontend (Next.js 16 + React 19 + Tailwind v4 — Implemented)"]
        Cloudflare -->|"Serves UI Pages"| NextApp["Next.js Application"]
        NextApp --> LocHook["LocationContext (Single Source of Truth)"]
        LocHook --> MapModule["Leaflet Map (Dynamic Sync + Radar + Cloud HUD — Implemented)"]
        NextApp --> ChatModule["Weather Assistant Drawer (Preview / Partial Impl — Phase 9 Target)"]
        NextApp --> DirectWeather["Direct weatherService.ts (Active Dashboard Runtime)"]
        NextApp --> GQLAdapter["GraphQL Client & weatherAdapter.ts (Phase 8.5.8 Target)"]
    end

    subgraph LocalDev["Local GraphQL Dev Gateway (Implemented)"]
        GQLAdapter -.->|"Local: POST /api/graphql"| YogaGateway["Next.js GraphQL Yoga (/api/graphql)"]
        YogaGateway --> DirectWeather
    end

    subgraph AWSCloud["AWS Production Architecture (Phase 8.5 Target — Not Deployed)"]
        GQLAdapter -->|"Production: HTTPS POST"| AppSync["AWS AppSync (Managed GraphQL Transport)"]
        
        AppSync --> WeatherLambda["weatherFunction Lambda (Thin Adapter)"]
        AppSync --> LocLambda["locationFunction Lambda (Thin Adapter)"]
        AppSync -.->|"Phase 9"| ChatLambda["assistantFunction Lambda (Thin Adapter)"]

        WeatherLambda --> DirectWeather
        LocLambda --> LocServices["geocodingService.ts & locationPersistenceService.ts"]
        
        SSM["AWS SSM Parameter Store"] -.->|"Runtime Secrets"| WeatherLambda
        CloudWatch["AWS CloudWatch"] <--|"Structured JSON Logs"| WeatherLambda
    end

    subgraph ExternalServices["External Providers"]
        WeatherAPI["Open-Meteo REST API (Live Weather & Geocoding)"]
        RainViewer["Radar Tile Service (RainViewer API v2 — Implemented Phase 8)"]
        LLMProvider["LLM API (Future Phase 9 Chatbot — Provider Not Yet Finalized)"]
    end

    subgraph DatabaseLayer["Supabase PostgreSQL (Current Implementation)"]
        SupaDB[("Supabase PostgreSQL\n(locations & geocoding_cache tables)")]
    end

    %% Data Flow Connections
    DirectWeather -->|"1. In-Memory Cache Check (< 1ms)"| DirectWeather
    DirectWeather -->|"2. If Miss/Stale: Fetch REST Weather"| WeatherAPI
    LocServices --> SupaDB
    LocServices --> WeatherAPI
    ChatLambda -.->|"Weather Grounding (Phase 9)"| LLMProvider
    MapModule -.->|"Direct Radar Tile Layer (Implemented Phase 8)"| RainViewer
```

---

## 3. Weather Service Integration Architecture (Implemented in Phase 3)

In Phase 3, the application connects the single source of truth (`activeLocation`) directly to a real meteorological provider (Open-Meteo REST API) through a provider-agnostic service layer.

```text
       [ activeLocation (lat, lon) ]
                     │
                     ▼
         [ weatherService.ts ]
    (Coordinate validation & 5-min cache)
                     │
                     ▼
       [ Open-Meteo REST API ]
   (https://api.open-meteo.com/v1/forecast)
                     │
                     ▼
         [ Provider Response ]
                     │
                     ▼
      [ Normalization & Mapping ]
   (WMO Codes mapped via weatherCodes.ts,
    Celsius values preserved internally,
    Timezone aligned via timezone=auto)
                     │
                     ▼
 [ Application Models (WeatherReport / WeatherData) ]
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
  [ CurrentWeatherCard ]  [ Forecast Lists ]
  (formatTemperature °C/°F)
```

### Architectural Key Characteristics
1. **Provider-Agnostic Interface**: The React components consume application models (`CurrentWeather`, `HourlyForecast`, `DailyForecast`, `WeatherReport`). Raw Open-Meteo responses are completely internal to `weatherService.ts`. In Phase 5, this service can easily query GraphQL rather than Open-Meteo without modifying the UI cards.
2. **Coordinate-Based Retrieval**: Weather is strictly determined by coordinates (`latitude`, `longitude`). Zero city-name conditionals exist. Device GPS, preset locations, and manual coordinates flow through the exact same pipeline.
3. **Internal Celsius Storage**: Weather temperatures are stored strictly in Celsius. `src/lib/temperature.ts` dynamically formats display values into °C or °F based on user preference without mutating underlying state.
4. **Centralized WMO Mapping (`src/lib/weatherCodes.ts`)**: WMO weather codes (0–99) are mapped once to `WeatherCondition` enums and condition descriptions.
5. **Timezone Alignment**: The Open-Meteo parameter `timezone=auto` ensures hourly forecasts and daily dates correspond to the location's local time rather than hardcoded timezones.
6. **Client-Side Cache**: An in-memory cache with ~5-minute TTL keyed by `${lat.toFixed(4)},${lon.toFixed(4)}` avoids redundant network calls. Bypassed when the user clicks "Refresh Weather" (`forceRefresh: true`).
7. **Strict Phase Boundaries**:
   - GraphQL has **NOT** been added.
   - AWS (Lambda, API Gateway, EventBridge) has **NOT** been added.
   - Supabase PostgreSQL has **NOT** been added.
   - Docker and Cloudflare have **NOT** been added.

---

## 3.1. Universal Location Search & Resolution Architecture (Phase 3.1)

In Phase 3.1, a dedicated resolution layer was introduced to guarantee that search text, coordinates, activeLocation, weather, and map remain strictly synchronized.

```text
                                USER INPUT
                                    │
                                    ▼
                        [ Search Input in UI ]
                                    │
                         Is it direct coordinates?
                         (e.g. "22.57, 88.36" or "22.57 88.36")
                               ┌────┴────┐
                         YES   │         │  NO
                               ▼         ▼
             [ Direct Coordinate Parser ]   [ Open-Meteo Geocoding API ]
             • Validate lat: -90 to +90      • https://geocoding-api.open-meteo.com/v1/search
             • Validate lon: -180 to +180    • Query city or place name (e.g. "Norway", "Springfield")
             • If invalid -> Show error      • If not found -> Show "Location not found" error
                               │         │
                               │         ▼
                               │   [ Search Results Disambiguation ]
                               │   • User sees: Name, State/Admin, Country
                               │   • User clicks desired result
                               └─────────┬─────────┘
                                         ▼
                             [ Atomic Location Update ]
                             activeLocation = {
                               name,
                               latitude,
                               longitude,
                               country,
                               admin1,
                               timezone
                             }
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
             [ Weather Service ]   [ Leaflet Map ]     [ Location Card ]
             Fetches new weather   Centers map         Shows new name &
             for new coordinates   on new coordinates  exact coordinates
```

### Architectural Key Characteristics
1. **Atomic Location Updates**: `name`, `latitude`, `longitude`, `country`, `admin1`, and `timezone` are always updated together as a single atomic unit. Never is a label changed while preserving stale coordinates.
2. **Direct Coordinate Parsing**: Valid decimal coordinates (comma- or space-separated, positive/negative, or with degree symbols) are parsed locally and validated within geographic bounds (`[-90, 90]` latitude, `[-180, 180]` longitude) without network calls.
3. **Disambiguation for Ambiguous Searches**: When geocoding returns multiple matches (such as "Springfield, Illinois" vs. "Springfield, Missouri"), all options are presented in an accessible list so the user selects the intended location.
4. **Keyless Architecture**: Uses the Open-Meteo Geocoding REST API, requiring no API keys or third-party credentials.

---

## 4. Current Milestone Status
- **Phase 0**: Completed (Planning & Simplified Architecture).
- **Phase 1**: Completed (Native Frontend Foundation).
- **Phase 2**: Completed (Location System & Leaflet Sync).
- **Phase 2.1**: Completed (Frontend Stabilization & Visual Polish).
- **Phase 3**: Completed (Live Weather Integration via Open-Meteo).
- **Phase 3.1**: Completed (Universal Location Search & Resolution).
- **Phase 4**: Completed (Supabase Persistent Locations & Geocoding Cache).
- **Phase 4.1**: Completed (Automatic 10m Weather Refresh & Live Saved Locations).
- **Step 1**: Completed (Navigation Shell & Shared Location Context).
- **Phase 5**: Completed (GraphQL Foundation & Application Gateway).
- **Phase 6**: Completed (AWS Serverless Setup — Implemented & verified locally; cloud deployment deferred).
- **Phase 7**: Completed (Weather Updates & Freshness Pipeline).
- **Phase 7.2**: Completed (Final Stabilization / Performance & Abort Handling).
- **Phase 8**: Completed (Simple Weather & Cloud Map — RainViewer Doppler Radar, Cloud Cover HUD, /maps, and Leaflet Sync).
- **Phase 8.5**: In Progress / Planned (AWS AppSync Integration — Phase 8.5.1 & 8.5.1-C Completed; Phase 8.5.2 Current Documentation Synchronization; SAM canonical IaC; domain services retained as business logic).
- **Phase 9**: Pending (Weather Chatbot — Next Feature Milestone: LLM integration, server-side weather grounding, and guardrail enforcement).

---

## 5. Supabase Persistent Data Layer & Geocoding Caching (Implemented in Phase 4)

```text
User Input / Search
         │
         ▼
[ Location Persistence Service ]
         │
  Is it in Supabase geocoding_cache?
  (query match & expires_at > now())
         ├─── YES ──► Return cached GeocodingResult[]
         │
         └─── NO  ──► Open-Meteo Geocoding REST API
                            │
                      Save results to
                   Supabase geocoding_cache (30d TTL)
                            │
                            ▼
                     [ activeLocation ]
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
     Weather Service   Leaflet Map    Supabase public.locations
     (Open-Meteo REST) (Follows Lat/Lon) (Deduplicated upsert on coord_key)
```

### Key Architectural Characteristics
1. **Zero Privileged Secrets on Frontend**: The browser client exclusively uses the public `anon` key paired with PostgreSQL Row Level Security (RLS). Service-role keys are never configured in frontend source code or bundles.
2. **Deterministic Deduplication**: `public.locations` computes a generated column `coord_key` (`ROUND(latitude, 4),ROUND(longitude, 4)`). Upserting by `coord_key` updates the timestamp without creating duplicate rows for the same physical location.
3. **Resilient Offline / Failure Fallback**: All Supabase calls are wrapped in non-blocking error guards. If Supabase is offline or misconfigured, the frontend logs a warning and gracefully falls back to direct Open-Meteo geocoding and weather fetching without crashing or interrupting the user.
4. **30-Day Geocoding Cache**: Repeated place-name queries are served directly from `public.geocoding_cache`, drastically reducing external network latency.

---

## 6. Automatic Refresh & Live Saved Locations Synchronization (Implemented in Phase 4.1)

```text
               [ Automatic Timer: 10m ]           [ Manual "↻ Refresh" Button ]
                          │                                     │
                          └─────────────────┬───────────────────┘
                                            │
                                            ▼
                           handleRefreshWeather({ force: true })
                                            │
                                            ▼
                             fetchWeatherData(lat, lon, { forceRefresh: true })
                                            │
                                            ▼
                                  Open-Meteo REST API
                                            │
                                            ▼
                            Normalize WeatherReport atomically
                       (Current + 24h Hourly + 7-Day Forecast)
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
             [ Success: HTTP 200 ]                        [ Error: Network ]
                     │                                             │
      Update weatherData & timestamp                Preserve existing weatherData;
      (Current, Hourly, Daily in sync)              Show non-destructive notice banner


-------------------------------------------------------------------------------------

Location Resolution / Selection
             │
             ▼
    activeLocation updates
    (Weather & Map update immediately)
             │
             ▼
    persistActiveLocation(loc)  ──► Supabase public.locations upsert
             │                                   │
             ▼                                   │
    Persistence resolves true ◄──────────────────┘
             │
             ▼
    getRecentPersistedLocations(5)
             │
             ▼
    savedLocations updates immediately
    (New location appears at top of Saved list without reload)
```

### Refresh & Persistence Specifications
1. **10-Minute Polling Cycle**: Polling runs every 10 minutes (`AUTO_REFRESH_INTERVAL_MS = 600000`) for the current active coordinates.
2. **Active Location Safety**: Polling timer is tied to `[activeLocation.latitude, activeLocation.longitude]`. When the location changes, the old timer is destroyed immediately and a fresh 10-minute cycle begins for the new location.
3. **Tab Visibility Awareness**: Automatic polling is suspended while the tab is hidden (`document.hidden`). When returned to `visible`, if ≥ 10 minutes have elapsed, an immediate refresh triggers and resets the interval.
4. **Cache Invalidation on Refresh**: `forceRefresh: true` bypasses the in-memory 5-minute cache, ensuring real updated observations and forecasts from Open-Meteo.
5. **Non-Destructive Error Handling**: If a refresh fails when weather is already rendered, the existing weather cards, 7-day forecast, and observation timestamp remain intact, and an inline notice informs the user without blowing away the dashboard.
6. **Race-Free Saved Locations Synchronization**: Instead of racing a Supabase read against an uncompleted write, `useLocationSystem` waits for `persistActiveLocation` to return `true` before fetching `getRecentPersistedLocations(5)`. The Saved UI pills update immediately with the persisted database record without requiring a page reload or subsequent search.

---

## 7. GraphQL API Layer & Application Gateway (Implemented in Phase 5)

```text
Next.js Frontend (or external client)
           │
           ▼
[ /api/graphql Gateway ]
(GraphQL Yoga App Router Route Handler)
           │
           ├────────────────────────┬────────────────────────┐
           ▼                        ▼                        ▼
[ weatherResolvers.ts ]   [ locationResolvers.ts ]   [ assistantResolvers.ts ]
           │                        │                        │
           ▼                        ▼                        ▼
  weatherService.ts         geocodingService.ts       Contract Stub
  (Celsius normalized)     (Supabase Cache + Search)
           │                        │
           ▼                        ▼
  Open-Meteo REST API      Supabase PostgreSQL
```

### Key Architectural Characteristics
1. **Application Gateway Boundary**: GraphQL serves as the application's internal API layer. Upstream providers (Open-Meteo REST) remain untouched. Resolvers delegate to existing domain services rather than duplicating HTTP or normalization logic.
2. **Normalized Celsius Representation**: All meteorological temperatures returned via GraphQL are strictly in Celsius. Display unit conversion (°C / °F) remains the exclusive responsibility of `LocationContext` and `temperature.ts` at the UI presentation boundary, eliminating any risk of double conversion.
3. **Non-Destructive Dashboard Preservation**: The active dashboard (`src/app/page.tsx`) continues using the proven direct `fetchWeatherData()` domain service. A drop-in adapter (`src/graphql/client/weatherAdapter.ts`) provides `fetchWeatherViaGraphQL()`, thoroughly verified with 100% response parity and ready for future migration.
4. **Lightweight Typed Client**: Built in `src/graphql/client/graphqlClient.ts` using native `fetch` and typed GraphQL operations (`src/graphql/client/operations.ts`), avoiding heavy third-party normalized caches that would fight with React 19 state.
5. **Zero Schema Alterations**: No new database tables were created (`weather_snapshots`, `forecast_hourly`, `forecast_daily` were avoided in favor of the existing in-memory 5-minute cache and `geocoding_cache`).
6. **Future Extensibility**: The schema design provides clean extension points for upcoming domains (Air Quality, Astronomy, Radar, Hazards) without requiring structural rewrites.

---

## 8. AWS Serverless Backend Foundation (Implemented in Phase 6)

```text
Next.js Frontend (or external client)
           │
           │ HTTPS POST /graphql
           ▼
[ Amazon API Gateway (HTTP API v2) ]
           │
           │ APIGatewayProxyEventV2
           ▼
[ AWS Lambda: graphqlHandler (backend/src/handlers/graphql.ts) ]
           │
           ├─► apigateway.ts (Transforms EventV2 <-> Web Request/Response)
           ├─► logger.ts (CloudWatch Structured JSON Logger)
           │
           ▼
[ GraphQL Yoga Engine (Reusable Schema & Resolvers) ]
           │
           ├────────────────────────┬────────────────────────┐
           ▼                        ▼                        ▼
[ weatherResolvers.ts ]   [ locationResolvers.ts ]   [ assistantResolvers.ts ]
           │                        │                        │
           ▼                        ▼                        ▼
  weatherService.ts         geocodingService.ts       Contract Stub
  (Open-Meteo REST)        (Supabase PostgreSQL)
```

### Key Architectural Characteristics
1. **Zero Business Logic Duplication**: The Lambda entry point (`backend/src/handlers/graphql.ts`) acts as a pure infrastructure wrapper. It reuses the exact same Phase 5 GraphQL SDL (`typeDefs.ts`), resolvers, and domain services (`weatherService.ts`, `geocodingService.ts`) used by the local Next.js route handler.
2. **HTTP API Gateway v2**: Utilizes AWS HTTP API v2 (Payload Format 2.0) for low-latency, cost-effective API routing with built-in CORS configuration, omitting legacy REST API v1 complexity.
3. **EventBridge Background Processing**: An independent Lambda worker (`backend/src/handlers/sync.ts`) is triggered on an EventBridge schedule (`rate(30 minutes)`). It queries recently tracked locations from Supabase via `locationPersistenceService.getRecentPersistedLocations(5)` (falling back to presets if empty) and warms weather caches.
4. **Structured Observability**: Integrates a lightweight structured JSON logger (`backend/src/utils/logger.ts`) emitting single-line JSON logs with correlation IDs (`requestId`), request paths, duration, and error stacks optimized for Amazon CloudWatch Logs Insights.
5. **Secret Isolation**: Sensitive server keys (`SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`) are fetched from AWS SSM Parameter Store (`/weather-gpt/{stage}/*`) at deploy/runtime and never exposed to the frontend client.
6. **Local Development Autonomy**: AWS infrastructure is purely additive. Local development continues to run seamlessly via Next.js and `/api/graphql` without requiring AWS credentials or local AWS emulation.
7. **Dashboard Preservation**: The active dashboard (`src/app/page.tsx`) intentionally remains connected directly to `weatherService.ts`. No premature migration to GraphQL or Lambda has been performed.

### 8.1 Transition to AWS AppSync (Phase 8.5 Architecture)
- **Managed GraphQL Transport**: While Phase 6 established an API Gateway v2 + GraphQL Yoga Lambda handler as a local serverless proof-of-concept, Phase 8.5 transitions the production AWS architecture to **AWS AppSync**.
- **Single Canonical IaC**: `backend/template.yaml` (AWS SAM) is the single canonical IaC definition for AppSync and its data source Lambda functions. `backend/serverless.yml` remains frozen at the Phase 6 foundation and is not an active AppSync IaC source.
- **Domain-Grouped Lambda Topology**: Rather than routing all GraphQL queries through a monolithic Yoga handler, AppSync delegates directly to domain-grouped Lambda functions:
  - `weatherFunction`: Resolves `weatherByCoordinates` and `refreshWeather`.
  - `locationFunction`: Resolves `searchLocations` and `savedLocations`.
  - `assistantFunction`: Resolves `askWeatherAssistant` (Phase 9 only).
- **Thin Adapters & Domain Ownership**: These Lambda functions are pure adapters; all meteorological math, tiered freshness, deduplication, and external network interactions remain inside `weatherService.ts`, `geocodingService.ts`, and `locationPersistenceService.ts`. AppSync and Lambda handlers must not duplicate or absorb domain business logic.

---

## 9. Weather Updates & Freshness Pipeline (Implemented in Phase 7)

```text
[ Client or Background Caller ]
              │
              ▼
    validateCoordinates()
              │
              ▼
    Check Memory Cache Entry
    ├─► If Fresh (< 5 min) and !forceRefresh:
    │     Return Cached WeatherReport immediately (< 1ms)
    │
    ├─► If Stale or forceRefresh:
    │     Check In-Flight Requests Map
    │     ├─► If In-Flight Request Active:
    │     │     Await Existing In-Flight Promise (Deduplicated Wire Request)
    │     │
    │     └─► If No In-Flight Request Active:
    │           Execute Single Open-Meteo REST Fetch
    │           ├─► On HTTP Success:
    │           │     Normalize -> Update Memory Cache -> Return Fresh Report
    │           │
    │           └─► On HTTP / Network Failure:
    │                 ├─► If Stale Cache Available (< 24h) and !forceRefresh:
    │                 │     Graceful Fallback: Return Cached Data with isStale: true
    │                 └─► Otherwise:
    │                       Throw descriptive error -> Display Non-Destructive Notice
```

### 1. Tiered Freshness Policy
The freshness engine establishes explicit meteorological freshness windows to avoid redundant API polling while maintaining real-time accuracy:
- **Current Conditions**: **5 minutes** (`CURRENT_TTL_MS = 300000`). Designed for fast atmospheric changes (temperature shifts, wind changes, precipitation onset).
- **Hourly Forecast (24-Hour Horizon)**: **30 minutes** (`HOURLY_TTL_MS = 1800000`). Aligns with numerical weather prediction (NWP) model update cadences.
- **Daily Forecast (7-Day Outlook)**: **2 hours** (`DAILY_TTL_MS = 7200000`). Global atmospheric projection models (ECMWF, GFS, ICON) update every 6–12 hours; rapid polling yields zero new information.
- **Stale Fallback Maximum Window**: **24 hours** (`STALE_FALLBACK_MAX_AGE_MS = 86400000`). Allows cached observations to serve as an emergency safety net during network outages.

### 2. In-Flight Request Deduplication
To prevent race conditions where a manual refresh, an automatic refresh, and an active location change trigger concurrent external calls for the same coordinates:
- An internal `inFlightRequests` registry tracks active `Promise<WeatherReport>` instances keyed by deterministic coordinate string (`lat.toFixed(4),lon.toFixed(4)`).
- Multiple callers requesting the same coordinates concurrently await the single in-flight network request.
- The registry is safely pruned in a `finally` block upon resolution or failure.
- Individual caller `AbortSignal`s are decoupled via `attachAbortSignal()` so one component aborting does not cancel the shared fetch for other components or the cache.

### 3. Stale-While-Revalidate & Graceful Failure Handling
- **Non-Destructive UI Preservation**: Refreshing weather never wipes existing rendered cards or flashes skeleton screens. `CurrentWeatherCard`, `HourlyForecastList`, and `DailyForecastList` retain previous valid observations while the background request resolves.
- **Network Outage Resilience**: If an external provider error occurs on a non-forced fetch, the service automatically falls back to valid cached data with `isStale: true`.
- **Informative Error Notice**: On manual refresh failure, an inline amber notice informs the user without removing previously displayed weather data.

### 4. Client Automatic & Manual Refresh Architecture
- **Cadence**: 10 minutes (`AUTO_REFRESH_INTERVAL_MS = 600000`).
- **Tab Visibility Awareness**: Suspends polling while tab is hidden (`document.hidden`); upon returning to `visible`, triggers a refresh only if ≥ 10 minutes elapsed since the last refresh.
- **Manual Synchronization**: Whenever a manual refresh succeeds, `lastRefreshTimeRef.current` is reset, preventing redundant immediate auto-refreshes.

### 5. Background Forecast Sync Worker (`backend/src/handlers/sync.ts`)
- **Execution**: Can be triggered locally or via AWS EventBridge (`rate(30 minutes)`).
- **Failure Isolation**: Employs per-location `try/catch` isolation so an invalid coordinate or individual provider timeout does not terminate the sync job.
- **Fallback Locations**: If Supabase has zero persisted locations, automatically falls back to default preset locations (`PRESET_LOCATIONS`).
- **Structured Reporting**: Returns `SyncResult` detailing `locationsAttempted`, `locationsSucceeded`, `locationsFailed`, `durationMs`, and per-location execution statuses.

### 6. Supabase Weather Cache Evaluation
- **Evaluation Decision**: Persistent weather snapshots/forecast tables (`weather_snapshots`, `forecast_hourly`, `forecast_daily`) remain **intentionally deferred**.
- **Rationale**:
  1. Storing 32 rows (current + 24 hourly + 7 daily) per coordinate lookup would rapidly bloat PostgreSQL storage and hit Supabase quota limits.
  2. Open-Meteo REST API is high-performance (< 200ms) with generous limits.
  3. The enhanced in-memory cache with tiered freshness, in-flight deduplication, and stale fallback delivers sub-millisecond (< 1ms) responses with zero database latency and zero maintenance overhead.
  4. Persistent weather tables are deferred to future phases when cross-container multi-region distributed caching (e.g. Redis / ElastiCache) or historical analytics are required.

---

## 10. Final Stabilization, Performance & Abort Handling (Implemented in Phase 7.2)

Phase 7.2 hardened the concurrent execution model, request deduplication, and UI lifecycle management to ensure zero unhandled rejections and uninterrupted user experience.

```text
[ Concurrent Caller 1 ] ──► fetchWeatherData(lat, lon, { signal: c1 }) ─┐
                                                                           ├─► [ Single In-Flight Request ]
[ Concurrent Caller 2 ] ──► fetchWeatherData(lat, lon, { signal: c2 }) ─┘          │
                                                                                    ▼
Caller 1 aborts (c1.abort())                                            [ Open-Meteo REST API ]
  ├─► Caller 1 rejects gracefully with AbortError                                   │
  └─► Caller 2 continues unaffected ◄───────────────────────────────────────────────┘
        │
        ▼
Resolves valid WeatherReport & populates in-memory cache for instant subsequent calls (< 20ms)
```

### Architectural Key Characteristics
1. **Caller Cancellation Isolation**:
   - Individual caller `AbortSignal`s are decoupled from the shared in-flight fetch via `attachAbortSignal()`.
   - When a caller cancels (e.g. React StrictMode unmount, rapid tab switch, or navigation away), only that caller's promise is rejected. The shared underlying network fetch completes normally, populating the cache and serving concurrent callers without throwing an unhandled `AbortError`.
2. **In-Flight Map Registry Pruning**:
   - `inFlightRequests` Map registry entries are reliably cleaned up in a `finally` block upon promise resolution or error.
   - Rapid sequential location switches (e.g. Kolkata -> London -> Kolkata) execute cleanly without abort collisions or stale promise retention.
3. **Non-Destructive Loading-State Handling**:
   - Initial data load is strictly decoupled from subsequent refreshes.
   - Skeletons render strictly when `!data`. When weather data is already present, manual and automatic refreshes activate a non-intrusive `isRefreshing` indicator, completely eliminating screen flickering and layout shift.
4. **Stale-While-Revalidate Fallback**:
   - Non-forced network failures retain cached observations for up to 24 hours with `isStale: true`, ensuring continuity during provider outages.
5. **Quality & Test Baseline (Historical Phase 7.2)**:
   - Verified across **68 / 68 automated tests** spanning 10 test suites (including `freshnessBugInvestigation.test.ts` and `inFlightAbortRegression.test.ts`).
   - Verified **0 TypeScript errors**, **0 ESLint errors/warnings**, and clean Next.js production build (`next build` generating 16 routes).
6. **Deployment Boundaries**:
   - AWS cloud deployment remains deferred / unprovisioned.
   - Docker containerization remains strictly deferred to Phase 10.
   - Cloudflare remains a future deployment target.

---

## 11. Simple Weather & Cloud Map Architecture (Implemented in Phase 8)

Phase 8 enriches WeatherGPT with interactive geospatial visualization, real-time Doppler precipitation radar, and sky coverage telemetry while strictly adhering to keyless architectural simplicity.

```text
[ activeLocation (lat, lon) ] ───► [ LocationContext ]
             │                             │
             │ Coordinates                 │ Coordinates
             ▼                             ▼
┌─────────────────────────┐   ┌───────────────────────────────┐
│   weatherService.ts     │   │     WeatherMapInternal.tsx    │
│  (Open-Meteo REST API)  │   │  (Leaflet Dynamic Center/Zoom)│
└────────────┬────────────┘   └───────────────┬───────────────┘
             │                                │
             │ cloud_cover (0-100%)           │ Radar Toggle: ON
             ▼                                ▼
┌─────────────────────────┐   ┌───────────────────────────────┐
│     Cloud Cover HUD     │   │     rainViewerService.ts      │
│  "Cloud Cover: 42%      │   │   (RainViewer API v2 JSON)    │
│   Partly Cloudy"        │   └───────────────┬───────────────┘
└─────────────────────────┘                   │
                                              │ Latest Radar Timestamp
                                              ▼
                              ┌───────────────────────────────┐
                              │    Leaflet TileLayer Overlay  │
                              │  (tile.rainviewer.com/v2/...) │
                              │    clamped at maxNativeZoom 7 │
                              └───────────────────────────────┘
```

### Architectural Key Characteristics
1. **Keyless RainViewer Doppler Radar Service (`rainViewerService.ts`)**:
   - Fetches live radar frame metadata from RainViewer API v2 (`https://api.rainviewer.com/public/weather-maps.json`) requiring zero credentials or API keys.
   - Enforces a 5-minute in-memory cache (`RADAR_CACHE_TTL_MS = 300000`) and in-flight request deduplication to prevent redundant network fetches.
   - Provides graceful fallback returning stale timestamp metadata if upstream network requests encounter transient errors.
   - Clamps radar tile layers to `maxNativeZoom: 7` (`L.tileLayer(..., { maxNativeZoom: 7, opacity: 0.65 })`) to avoid HTTP 404 tile errors beyond RainViewer's native radar coverage, while allowing the underlying OpenStreetMap base map to zoom cleanly up to Leaflet max.
2. **Deterministic Layer Lifecycle Management (`WeatherMapInternal.tsx`)**:
   - Safely mounts and tears down radar tile layers using a version-tracked ref (`layerIdRef`).
   - Automatically removes stale radar layers before mounting new layers during rapid toggling or location updates, preventing tile leakage and memory bloat.
3. **Cloud Cover Telemetry & Dynamic HUD**:
   - Enriches Open-Meteo REST queries with `cloud_cover` parameters for both current observations and hourly projections.
   - Renders a floating Cloud Cover HUD displaying real-time cloud percentage and semantic descriptors (`Clear: 0–19%`, `Partly Cloudy: 20–59%`, `Mostly Cloudy: 60–84%`, `Overcast: 85–100%`).
4. **UI Layout Separation (Zoom Controls / Top Bar)**:
   - Corrective positioning applied to the map top bar (`top-2.5 left-14 right-2.5`) providing a 12px horizontal buffer from Leaflet's native zoom controls (`+ / −` at `left: 10px`), ensuring zero overlap on both dashboard cards and `/maps`.
5. **Multi-Instance Support**:
   - Powers both the compact dashboard preview card (`src/components/map/WeatherMap.tsx`) and the dedicated full-page route (`src/app/maps/page.tsx`).
6. **Quality & Verification Baseline**:
   - Verified across the **85-test Phase 8 baseline, now 86 core assertions after the map UI patch, with the main `npm test` command still executing only the original 68 tests across 10 suites (standalone verification scripts and newly added suites exist outside the standard `npm test` script)**.
   - Verified **0 TypeScript errors**, **0 ESLint errors/warnings**, and clean Next.js production build (`next build` generating 16 routes).

---

## 12. Weather Assistant Architecture & Preparation (Partially Implemented / Phase 9 Target)

WeatherGPT includes a dedicated Weather Assistant component designed to provide natural-language answers grounded strictly in verified meteorological data.

### 1. Current Verified Implementation (Partial)
- **Frontend Chatbot UI (`src/components/chatbot/WeatherAssistant.tsx`)**:
  - Interactive chat interface rendered directly on the dashboard.
  - Features labeled header ("Weather Assistant" / "Weather-only Advisor"), local message thread state, location-aware greeting, input validation, send button, and preview responses.
- **GraphQL Schema & Resolvers (`typeDefs.ts`, `weatherResolvers.ts`)**:
  - SDL includes `type ChatResponse { reply: String!, isOffTopic: Boolean! }`.
  - Mutation `askWeatherAssistant(message: String!, coordinates: CoordinatesInput): ChatResponse!`.
  - Resolver stub validates message length and returns a structured response indicating Phase 9 connection readiness.
- **Client Operations (`operations.ts`)**:
  - Typed `ASK_WEATHER_ASSISTANT_MUTATION` ready for invocation.
- **AWS Backend Compatibility**:
  - Reused in AWS Lambda (`backend/src/handlers/graphql.ts`) and configured with generic `LLM_API_KEY` secret parameter.

---

## 13. Radar Playback Timeline & Precipitation Nowcast Architecture (Stage 5 & 6)

### 1. RainViewer Doppler Radar Playback System
- **Provider**: RainViewer Public Weather Maps API v2 (`https://api.rainviewer.com/public/weather-maps.json`).
- **Timeline Frame Sequencing (`src/lib/rainViewerService.ts`)**:
  - Automatically parses past frames (`radar.past`) and future nowcast projections (`radar.nowcast`).
  - Constructs Slippy Map tile URL templates: `{host}{path}/{size}/{z}/{x}/{y}/{colorScheme}/{options}.png`.
  - Sets default frame to the latest recorded past observation (`currentFrameIndex = past.length - 1`).
- **Interactive Leaflet Playback Controller (`WeatherMapInternal.tsx`)**:
  - Floating playback controller dock docked on the map canvas.
  - **Animation Loop**: 850ms cycle timer advancing sequential frames across past and nowcast observations.
  - **Granular Navigation**: Frame scrubber range input and Step Backward (⏮️) / Step Forward (⏭️) controls.
  - **Tile Swapping Performance**: Direct URL update via `tileLayer.setUrl()` prevents layer teardown latency and memory thrashing.
  - **Opacity & Visibility**: Interactive slider (10% to 100%) and layer toggle (👁️ / 🙈) with seamless opacity transitions.
  - **Lifecycle Cleanup**: Strict layer removal from Leaflet map and interval cancellation on unmount or radar deactivation.

### 2. Open-Meteo 15-Minute Precipitation Nowcast (`/nowcast` Route)
- **Provider**: Open-Meteo Forecast REST API (`minutely_15=precipitation,precipitation_probability,weather_code&forecast_minutely_15=8`).
- **Modeling & Normalization (`src/lib/weatherService.ts`)**:
  - Captures 8 discrete 15-minute intervals spanning a 120-minute horizon.
  - Converts interval millimeters into hourly rate: `precipitationRateMmH = precipitationMm * 4`.
  - Classifies meteorological intensity: `dry` (<=0.05 mm/h), `light` (0.05–2.5 mm/h), `moderate` (2.5–10 mm/h), `heavy` (10–50 mm/h), `violent` (>=50 mm/h).
  - Calculates cumulative 2h volume, peak probability, and estimated precipitation start offset.
- **Client Cache & Resilience**:
  - In-memory 5-minute TTL cache (`NOWCAST_CACHE_TTL_MS`).
  - In-flight request deduplication collapsing concurrent callers into one fetch.
  - Stale fallback preserving cached projection on upstream network failures.
- **User Interface (`src/app/nowcast/page.tsx`)**:
  - 4 Key Summary Badges: Horizon (Next 120 Mins), Max Probability (%), Current Intensity (mm/h), 2h Total Volume (mm).
  - Trajectory Banner: Contextual alert detailing precipitation timing.
  - Responsive Bar Projection Chart: Color-coded bars proportional to intensity with hover value tooltips.
  - Detailed 15-Minute Interval Table: Chronological breakdown with probability progress bars and WMO condition descriptions.

---

## 14. Wind Patterns, Cloud Cover & Satellite Imagery Layer Architecture (Stage 7 Implemented)

Stage 7 extends the Leaflet map architecture with dedicated service abstractions, layer controls, and interactive HUD metrics for wind vector flow, cloud cover density, and open satellite imagery.

```text
[ activeLocation (lat, lon) ] ───► [ LocationContext ]
             │
             ├───► [ windService.ts ] ──► Open-Meteo REST API
             │       - 16-point cardinal compass (degreesToCardinal)
             │       - Beaufort scale 0–12 (getBeaufortScale)
             │       - SVG vector arrow generation (generateWindArrowSvg)
             │       - 5-minute cache & request deduplication
             │
             ├───► [ satelliteService.ts ]
             │       - Esri World Imagery (High-res satellite tiles)
             │       - NASA GIBS Terra TrueColor (Daily imagery browse)
             │       - Keyless, open providers & explicit attribution
             │
             └───► [ WeatherMapInternal.tsx ]
                     - Layer Control Bar (OSM, Radar, Wind, Cloud, Satellite)
                     - Dynamic SVG Wind Direction Arrow at activeLocation
                     - Wind & Cloud Metric HUD Badge
                     - Toggleable Cloud & Satellite Overlays with Opacity Sliders
                     - Memory-safe Leaflet TileLayer & Marker cleanup
```

### 1. Wind Service & Vector Marker Architecture (`src/lib/windService.ts`)
- **Open-Meteo Wind Extraction**: Retrieves `wind_speed_10m`, `wind_direction_10m`, and `wind_gusts_10m` with 5-minute in-memory caching and deduplication.
- **16-Point Cardinal Compass**: Maps 360° degrees to 16 cardinal points (`N`, `NNE`, `NE`, `ENE`, `E`, `ESE`, `SE`, `SSE`, `S`, `SSW`, `SW`, `WSW`, `W`, `WNW`, `NW`, `NNW`).
- **Beaufort Scale Classification**: Converts km/h wind speeds to standard Beaufort scale numbers (0–12) with descriptive labels (e.g. `Light Breeze`, `Fresh Breeze`, `Gale`, `Hurricane`).
- **SVG Wind Arrow Vector**: Generates crisp, inline rotated SVG vector arrows using Leaflet `L.divIcon` pointing in the direction of wind flow (`rotate(direction + 180deg)`).

### 2. Open Satellite Imagery Service (`src/lib/satelliteService.ts`)
- **Keyless Tile Providers**:
  - **Esri World Imagery**: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` with `maxNativeZoom: 18` and Esri attribution.
  - **NASA GIBS Terra TrueColor**: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg` with `maxNativeZoom: 9` and NASA EOSDIS GIBS attribution.
- **Provider Switching & Opacity Control**: React map state supports smooth toggling, provider selection, and opacity adjustment (10%–100%).

### 3. Combined Map Layer Switcher & HUD Controls (`WeatherMapInternal.tsx`)
- **Top Control Bar**: Clean layer selector coexisting with Leaflet zoom buttons allowing users to toggle and combine:
  - Base Map (OpenStreetMap)
  - Doppler Radar (RainViewer with timeline controls)
  - Wind HUD & Directional Vector Arrow
  - Cloud Cover Overlay & Metric HUD
  - Live Satellite Imagery (Esri / NASA)
- **Memory Safety & Lifecycle**: Leaflet markers and tile layers are tracked in React refs (`windMarkerRef`, `satelliteLayerRef`, `cloudLayerRef`) and explicitly removed on toggle off or unmount to guarantee zero memory leaks.

### 4. Stage 7.1 Map Polish & Dynamic Status Synchronization
- **Live Cloud Overlay**: Powered by NASA GIBS MODIS Terra Cloud Fraction Day (`MODIS_Terra_Cloud_Fraction_Day`) with transparent background, smooth `setOpacity` transitions, and live indicator badge.
- **Regional Wind Vector Grid**: Generates a 5x5 grid of streamline markers across visible map bounds with GPU-accelerated CSS flow/pulse animations matching wind speed; automatically refreshes on map `moveend`.
- **Harmonized Status Cards**: Reusable `MapStatusCards` synchronized with active layer state (`LayerState`) across `/maps` and dashboard:
  - Doppler Radar glows sky-blue when Doppler stream is playing.
  - Cloud/Satellite card glows sky-blue when Cloud or Satellite layers are active.
  - Idle cards retain clean neutral borders (`border-slate-200 bg-white/70`).

---

## 15. Severe Weather Alerts & Thunderstorm Tracking Architecture (Stage 8 Implemented)

Stage 8 introduces full-spectrum severe weather advisory detection, convective thunderstorm tracking, map-based lightning visualization, and system-wide network timeout resilience.

```text
[ activeLocation (lat, lon) ] ───► [ LocationContext ]
             │
             ├───► [ alertsService.ts ]
             │       ├── US Bounding Box: US NWS GeoJSON API (api.weather.gov/alerts/active)
             │       └── Global / International: Open-Meteo Synoptic Severe Risk Derivation
             │       - Normalized Alert Model (Extreme, Severe, Moderate, Minor)
             │       - 5-Minute In-Memory Cache, In-Flight Deduplication & Stale Fallback
             │
             ├───► [ stormService.ts ] ──► Open-Meteo Hourly Forecast API
             │       - WMO Convective Codes (95, 96, 99 thunderstorms; squalls, heavy showers)
             │       - Lightning Potential Index (0–100) & Convective Risk (None, Moderate, High, Severe)
             │       - Regional Storm Cell Cluster Synthesis (Bearing, Distance, Motion)
             │       - 6-Hour Forward Convective Forecast Horizon
             │
             ├───► [ Leaflet WeatherMap (WeatherMapInternal.tsx) ]
             │       - "⚡ Storms" Layer in Top-Left Switcher Bar
             │       - Animated Flashing L.divIcon Storm / Lightning Markers
             │       - Convective Cell Popups (Storm Type, Gusts, Rain Rate, Lightning Score)
             │       - Point Metric HUD Storm Indicator
             │       - Complete Ref Teardown & Marker Cleanup on Toggle Off
             │
             └───► [ Dedicated Pages ]
                     ├── /alerts: Live Severity Cards, Red/Amber Alerts & Instructions Drawer
                     └── /storms: Convective Gauge, Hazard Assessment & Safety Protocols
```

### 1. Resilience & Network Timeout Management
- **RainViewer Doppler Radar Service (`src/lib/rainViewerService.ts`)**:
  - `RAINVIEWER_DEFAULT_TIMEOUT_MS` increased from 5,000ms to 10,000ms (10 seconds) to accommodate high-latency mobile networks and satellite imagery fetch pipelines.
  - Single-retry network fallback added: transient network failures automatically trigger an immediate second fetch before falling back to cached or empty radar timelines.
- **AWS Serverless SAM Template (`backend/template.yaml`)**:
  - Increased `WeatherFunction` execution timeout from 10s to 25s, mitigating Lambda cold starts and multi-hop API aggregation delays.

### 2. Severe Weather Alerts Service (`src/lib/alertsService.ts`)
- **Multi-Source Ingestion & Bounding Box Routing**:
  - Automatically routes US coordinates (`3.0 <= lat <= 72.0` and `-179.0 <= lon <= -65.0`) to the US National Weather Service GeoJSON alerts endpoint (`https://api.weather.gov/alerts/active?point={lat},{lon}`) with explicit `User-Agent`.
  - Routes non-US/international coordinates to Open-Meteo synoptic analysis, evaluating severe wind gusts (>70 km/h), torrential precipitation (>15 mm/h), extreme temperatures (>=40°C heat advisory, <=-15°C wind chill), and thunderstorm codes (WMO 95, 96, 99).
- **Normalized Alert Schema**:
  - `id`: Unique identifier string.
  - `event`: Standardized headline or advisory title (e.g. `Severe Thunderstorm Warning`, `High Wind Advisory`).
  - `severity`: Standard 4-tier meteorological severity (`Extreme`, `Severe`, `Moderate`, `Minor`).
  - `urgency`: `Immediate`, `Expected`, `Future`, or `Past`.
  - `headline` & `description`: Full descriptive summary of the meteorological hazard.
  - `instruction`: Concrete civilian safety action directives (e.g. "Move to an interior room on the lowest floor").
  - `effective` & `expires`: ISO 8601 timestamps.
  - `areaDesc`: Affected geographical county, zone, or city.
  - `source`: Meteorological authority source attribution.
- **Client Cache & Tiered Resilience**:
  - 5-minute memory cache (`ALERTS_CACHE_TTL_MS = 300_000`).
  - In-flight request deduplication preventing concurrent duplicate fetches.
  - Stale fallback preserving cached advisories if upstream network drops occur.

### 3. Thunderstorm & Convective Tracking (`src/lib/stormService.ts`)
- **Meteorological Convective Indicators**:
  - WMO Convective Codes: 95 (Thunderstorm with rain/snow), 96 (Thunderstorm with slight hail), 99 (Thunderstorm with heavy hail), 80–82 (Heavy showers), 77 (Snow grains/ice pellets), 17/29 (Squalls, dust storms).
  - Multi-factor Convective Score (0–100): Combines WMO code severity, peak gusts (km/h), precipitation intensity (mm/h), and CAPE proxy.
  - Storm Risk Categorization: `None` (0–19), `Moderate` (20–49), `High` (50–84), `Severe` (85–100).
- **Regional Storm Cell Modeling**:
  - Dynamically synthesizes localized convective cells within a 15–50km radius with bearing, distance, estimated motion direction, and hazard rating.
- **Hourly Convective Forecast**:
  - Provides a 6-hour forward-looking convective probability and risk progression.

### 4. Leaflet Map Lightning & Storm Layer (`WeatherMapInternal.tsx`)
- **Map Control Integration**:
  - Added `⚡ Storms` toggle to the persistent top-left layer switcher bar.
- **Visual Representation**:
  - Uses custom `L.divIcon` HTML markers with CSS `@keyframes storm-pulse` emitting expanding amber/yellow shockwaves and a glowing bolt icon.
  - Interactive Leaflet popup displaying storm type, convective score, peak wind gusts, and precipitation risk.
- **Safe Lifecycle Management**:
  - Markers stored in `stormMarkersRef` and systematically removed on toggle off, location change, or component unmount.

---

## 16. Geohazards Architecture (Stage 9)

```text
                                  [ User Location / Coordinates ]
                                                 │
      ┌──────────────────────────────────────────┼──────────────────────────────────────────┐
      ▼                                          ▼                                          ▼
[ Earthquakes Service ]                 [ Volcanoes Service ]                     [ Tsunamis Service ]
(earthquakeService.ts)                  (volcanoService.ts)                       (tsunamiService.ts)
  │ USGS GeoJSON 2.5_day / all_day        │ Smithsonian GVP & USGS VHP Reports      │ NOAA / PTWC Advisory Feed
  │ Haversine Distance & Bearing          │ Aviation Color Codes & Status           │ Warning / Advisory / Watch Status
  │ M2.5+, M4.5+, M6.0+ & Scope           │ Erupting vs Unrest Distinction          │ Basin Coverage & Safety Rules
  │ 5-Minute Cache & Deduplication        │ 15-Minute Cache & Deduplication         │ 5-Minute Cache & Deduplication
      │                                          │                                          │
      ├──────────────────────────────────────────┼──────────────────────────────────────────┤
      ▼                                          ▼                                          ▼
[ /earthquakes Page ]                   [ /volcanoes Page ]                       [ /tsunamis Page ]
- Nearest Quake Card                    - Active Eruption Feed                    - Active Status Banner
- Severity Badges & Depth               - Aviation Badges                         - Emergency Safety Rules
- Distance/Bearing Filtered Feed        - Distance to Active Location             - Affected Ocean Basins
      │                                          │
      └──────────────────┬───────────────────────┘
                         ▼
          [ Leaflet Layer Groups ]
          (WeatherMapInternal.tsx)
          - "🌋 Earthquakes" Isolated LayerGroup (Scaled Concentric Circles & Popups)
          - "🌋 Volcanoes" Isolated LayerGroup (Aviation Color Code Badges & Popups)
          - Clean clearLayers() Execution on Toggle Off / Component Unmount
```

### 1. USGS Live Earthquakes Service (`src/lib/earthquakeService.ts`)
- **Data Ingestion**: Real-time USGS GeoJSON feed (`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson` with fallback to `all_day.geojson`).
- **Spatial Calculations**: Computes Haversine distance in km (`calculateHaversineDistanceKm`) and cardinal bearing (`calculateCardinalBearing`) from the user's `activeLocation`.
- **Severity Classification**:
  - `minor`: M < 4.5 (Green badge `#10b981`)
  - `moderate`: 4.5 <= M < 6.0 (Amber badge `#f59e0b`)
  - `strong`: 6.0 <= M < 7.0 (Orange badge `#f97316`)
  - `major`: M >= 7.0 (Red badge `#ef4444`)
- **Filtering Options**: Min magnitude (`all`, `m2.5`, `m4.5`, `m6.0`) and proximity scope (`local` <500km, `regional` <1500km, `global`).
- **Caching & Resilience**: 5-minute memory cache (`EARTHQUAKE_CACHE_TTL_MS = 300_000`) and in-flight request deduplication.

### 2. Smithsonian GVP / USGS Volcanoes Service (`src/lib/volcanoService.ts`)
- **Data Normalization**: Ingests volcano activity reports, extracting name, country, coordinates, elevation, activity status, and Aviation Color Code (`GREEN`, `YELLOW`, `ORANGE`, `RED`).
- **Status Distinction**: Strictly delineates between confirmed `Active Eruption` volcanoes (`isErupting`) and `Minor Activity / Unrest` / quiet volcanoes (`isUnrestOrErupting`).
- **Proximity**: Calculates distance and cardinal bearing to `activeLocation`.
- **Caching**: 15-minute memory cache (`VOLCANO_CACHE_TTL_MS = 900_000`) and deduplication.

### 3. NOAA / PTWC Tsunamis Service (`src/lib/tsunamiService.ts`)
- **Advisory Feed**: Ingests live NOAA National Tsunami Warning Center & PTWC bulletin feeds (`tsunami.gov`).
- **Status Levels**: `WARNING`, `ADVISORY`, `WATCH`, `INFORMATION`, and `NO_ACTIVE`.
- **Safety Protocol Engine**: Dynamically matches status level with actionable civilian emergency safety directives (evacuation, higher ground, shoreline recession warnings).
- **Caching**: 5-minute memory cache (`TSUNAMI_CACHE_TTL_MS = 300_000`) and deduplication.

### 4. Leaflet Geohazard Map Layers (`WeatherMapInternal.tsx`)
- **Isolated Layer Groups**: Dedicated `earthquakeLayerGroupRef` and `volcanoLayerGroupRef` Leaflet `LayerGroup` instances attached to `mapInstanceRef.current`.
- **Toggle Control**: Top-left map controls bar buttons `🌋 Earthquakes` and `🌋 Volcanoes` with active state indicators.
- **Marker Design**:
  - Earthquakes: Concentric SVG DivIcons with magnitude-scaled radius and pulsing animated shockwaves.
  - Volcanoes: Emoji DivIcon markers surrounded by an Aviation Color Code border ring.
- **Clean Teardown**: Explicit `clearLayers()` on layer toggle off and component unmount, strictly preserving existing map layers (Radar, Wind, Clouds, Satellite, Storms).


