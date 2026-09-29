# WeatherGPT — System Architecture

## 1. Architectural Principles

1. **Simplicity Over Complexity**: Minimal moving parts, avoiding Kubernetes, microservices, or complex spatial pipelines.
2. **Single Source of Truth for Location**: The frontend maintains one active location state in `LocationContext` consumed by the header, navigation modal, location cards, map, and weather domain services.
3. **Provider-Agnostic Domain Services**: `weatherService.ts` encapsulates meteorological requests and normalizes them into clean Celsius domain models. External weather providers use standard REST (Open-Meteo).
4. **Deterministic In-Memory Caching & Freshness**: Tiered freshness windows (5m current, 30m hourly, 2h daily, 24h stale fallback) with in-flight request deduplication and non-destructive UI updates.
5. **Clear Application Boundaries**: GraphQL is strictly the application's internal API layer at `/api/graphql`; the dashboard currently operates on direct `weatherService.ts` with zero disruption.
6. **Relational Persistence (Current Implementation)**: Supabase PostgreSQL stores user-selected locations (`public.locations`) and caches 30-day geocoding search queries (`public.geocoding_cache`) with Row Level Security.
7. **Serverless on AWS (Local Foundation / Cloud Deployment Deferred)**: Serverless execution foundation (`backend/` with Lambda, API Gateway v2, EventBridge, CloudWatch) implemented and verified locally; actual cloud provisioning remains deferred.
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

## 3. End-to-End System Architecture (Target Full-Stack Architecture)

> **Architectural Status Note**:
> This diagram illustrates the complete target deployment topology. The **Frontend**, **Leaflet Map**, **RainViewer Doppler Radar**, **Cloud Cover HUD**, **Location System**, **weatherService**, and **Supabase Database (locations & geocoding_cache)** are fully implemented and verified. The **GraphQL Gateway** and **AWS Backend Foundation** are implemented and verified locally, while actual AWS cloud deployment, Cloudflare edge, and Phase 9+ AI modules remain future targets.

```mermaid
flowchart TD
    UserClient["User Browser / Client"] -->|"HTTPS"| Cloudflare["Cloudflare (Target: DNS / Full Strict SSL / CDN)"]
    
    subgraph FrontendApp["Frontend (Next.js 16 + React 19 + Tailwind v4 — Implemented)"]
        Cloudflare -->|"Serves UI Pages"| NextApp["Next.js Application"]
        NextApp --> LocHook["LocationContext (Single Source of Truth)"]
        LocHook --> MapModule["Leaflet Map (Dynamic Sync + Radar + Cloud HUD — Implemented)"]
        NextApp --> ChatModule["Weather Assistant Drawer (Preview / Partial Impl — Phase 9 Target)"]
        NextApp --> DirectWeather["Direct weatherService.ts (Active Dashboard)"]
        NextApp --> GQLClient["GraphQL Adapter / Client (Verified Parity)"]
    end

    subgraph AWSCloud["AWS Serverless Backend (Local IaC Verified; Cloud Deployment Deferred)"]
        GQLClient -->|"POST /graphql (lat, lon)"| APIGW["API Gateway (HTTP API v2)"]
        APIGW --> GQL_Lambda["GraphQL Lambda Handler (Node.js/TS)"]
        
        SecretsManager["AWS Secrets Manager / SSM"] -.->|"Runtime Secrets"| GQL_Lambda
        CloudWatch["AWS CloudWatch"] <--|"Logs & Metrics"| GQL_Lambda

        EventBridge["AWS EventBridge (~30m Scheduled Rule)"] --> Sync_Lambda["Forecast Sync Worker Lambda"]
        SecretsManager -.->|"Runtime Secrets"| Sync_Lambda
        CloudWatch <--|"Logs & Metrics"| Sync_Lambda
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
    
    GQL_Lambda -->|"A. Delegate to weatherService.ts"| DirectWeather
    GQL_Lambda -->|"B. Delegate to persistenceService.ts"| SupaDB
    GQL_Lambda -->|"C. Return Typed GraphQL Response"| APIGW

    Sync_Lambda -->|"I. Read Recent Locations"| SupaDB
    Sync_Lambda -->|"II. Warm Weather Caches"| WeatherAPI

    GQL_Lambda -.->|"Weather Guardrail (Phase 9)"| LLMProvider
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
   - Verified across **85 / 85 automated tests** spanning 12 test suites (including `rainViewerService.test.ts` and `mapUiIntegration.test.ts`).
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

### 2. Remaining Phase 9 Target Scope
The Weather Assistant is **NOT** a completed AI chatbot. The following components will be implemented in Phase 9:
- **LLM Provider Integration**: Connecting the server-side resolver to an LLM provider. (Note: The provider is **not yet finalized**; `LLM_API_KEY` remains a generic contract).
- **Server-Side Meteorological Grounding**: Injecting verified current observations and forecast models directly into the prompt context.
- **Server-Side Weather Guardrail**: Deterministic classifier ensuring the assistant rejects non-weather queries (`isOffTopic: true`).
- **Frontend Mutation Dispatch**: Replacing the local preview handler with live GraphQL mutation calls.
- **Secure Secret Provisioning**: Provisioning runtime API keys in SSM/Secrets Manager for production execution.
- **Automated AI Tests**: Deterministic test suites validating guardrail rejection and grounded responses.




