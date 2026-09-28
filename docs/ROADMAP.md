# Simple Weather Web Application — Roadmap

This roadmap defines the step-by-step implementation plan. Work proceeds sequentially, strictly phase-by-phase without premature execution of downstream phases.

---

## Roadmap Overview

```
[Phase 0] Planning & Simplified Architecture (COMPLETED)
    │
    ▼
[Phase 1] Native Frontend Foundation (COMPLETED)
    │
    ▼
[Phase 2] Location System (COMPLETED)
    │
    ▼
[Phase 3] Weather Service Integration (COMPLETED)
    │
    ▼
[Phase 4] Supabase PostgreSQL (COMPLETED)
    │
    ▼
[Phase 4.1] Auto Weather Refresh & Live Saved Locations (COMPLETED)
    │
    ▼
[Step 1] Navigation Shell & Global Location Context (COMPLETED)
    │
    ▼
[Phase 5] GraphQL API Layer & Application Gateway (COMPLETED)
    │
    ▼
[Phase 6] AWS Serverless Setup (COMPLETED - Verified Locally)
    │
    ▼
[Phase 7] Weather Updates (Pending — Next Phase)
    │
    ▼
[Phase 7] Weather Updates (Short-Lived Current Cache + EventBridge ~30m Sync)
    │
    ▼
[Phase 8] Simple Weather Map (Leaflet Cloud & Precipitation Overlays)
    │
    ▼
[Phase 9] Weather Chatbot (Simple Guardrail & Grounded Meteorological Advice)
    │
    ▼
[Phase 10] Docker Containerization (Dockerfile & Image Verification — ONLY after local app works)
    │
    ▼
[Phase 11] Cloudflare Edge & HTTPS (Simple DNS, Full Strict SSL, Asset CDN)
    │
    ▼
[Phase 12] Testing & Verification
```

---

## Phase Details

### Phase 0: Planning & Simplified Architecture
- **Status**: **Completed**

---

### Phase 1: Native Frontend Foundation
- **Status**: **Completed**

---

### Phase 2: Location System
- **Status**: **Completed**
- **Goal**: Implement the complete location-selection system that acts as the single source of truth for coordinates.
- **Completed Deliverables**:
  - `ActiveLocation` data model: `id`, `name`, `country`, `latitude`, `longitude`, `accuracy`, `source`, `timestamp`.
  - `useLocationSystem` hook: Encapsulates single source of truth state, device geolocation, manual selection, and error handling.
  - Browser Geolocation flow: Strictly user-initiated via "Use My Location" button (no continuous tracking, no auto-prompting). Captures latitude, longitude, and accuracy in meters.
  - User-friendly error handling: Clear messages for permission denial, unavailable location, request timeout, and unsupported browsers.
  - Manual location selection: Instant preset buttons (London, Kolkata, New York, Tokyo, Paris, Sydney) and manual text search with coordinate parser support.
  - Leaflet Map synchronization: Map center, active marker, and accuracy circle (`L.circle`) dynamically synchronize with active location.
  - Verification: `npm run lint` (0 errors), `npm run build` (0 errors), and automated tests (`locationSystem.test.ts`) passed.
  - **No live weather APIs, GraphQL, Supabase, or AWS code was implemented.**

---

### Phase 2.1: Frontend Stabilization & Visual Polish
- **Status**: **Completed**
- **Goal**: Address frontend stabilization, unit conversions, and light-theme visual polish while strictly keeping the approved visual hierarchy and isolated mock data.
- **Completed Deliverables**:
  - **Hydration Mismatch Resolved**: Verified that client/server time-formatting mismatch is fully resolved.
  - **Weather Assistant Input Verified**: Tested input focus, typing, blur, Enter key form submit, and Send button interactions; ensured high contrast and legible placeholder/text.
  - **Celsius / Fahrenheit Conversion Fixed**: Created centralized `src/lib/temperature.ts` utility implementing `°F = (°C × 9/5) + 32`. Converts current temperature (e.g. 19°C -> 66.2°F), feels-like, hourly, and daily min/max values without mutating underlying Celsius state.
  - **Natural Light Theme Established**: Transitioned from dark navy styling to a clean, human-designed light weather-app aesthetic with light gray backgrounds (`#f8fafc`), white cards, subtle borders, and readable typography.
  - **Responsive Layout Verified**: Verified layout and control padding across desktop, tablet, and mobile breakpoints without horizontal overflow.
  - **Mock Weather Isolated**: Current weather remains mock/preview data as planned. Live weather API integration has **NOT** started.
  - **Phase 3 Status**: **NOT STARTED** (Awaiting approval).

---

### Phase 3: Weather Service Integration (Live/Current Weather)
- **Status**: **Completed**
- **Goal**: Connect active location coordinates (`latitude`, `longitude`) to real meteorological data via Open-Meteo REST API.
- **Completed Deliverables**:
  - **Provider Integration**: Open-Meteo standard forecast endpoint (`https://api.open-meteo.com/v1/forecast`) queried using coordinate parameters with `timezone=auto` and 7-day forecast horizon.
  - **Strict Coordinate-Based Request**: Weather is determined strictly by `activeLocation.latitude` and `activeLocation.longitude`. Zero hardcoded city conditionals.
  - **Dedicated Weather Service (`src/lib/weatherService.ts`)**: Provider-agnostic service layer that encapsulates API requests, validation, caching, and normalization. React components do not access Open-Meteo directly.
  - **Normalized Application Models**: Raw provider structures are normalized into clean, typed `CurrentWeather`, `HourlyForecast`, `DailyForecast`, and `WeatherReport` models. Internal temperatures are stored strictly in Celsius.
  - **Centralized WMO Weather Code Mapping (`src/lib/weatherCodes.ts`)**: Single mapping table from WMO codes (0–99) to `WeatherCondition` union and descriptive text with safe fallback for unknown codes.
  - **Timezone Alignment**: Used Open-Meteo `timezone=auto` parameter so hourly forecasts and daily dates correspond to the location's local time rather than hardcoded timezones.
  - **Temperature Units**: Preserved existing `src/lib/temperature.ts` conversion system. Values convert accurately between °C and °F across current, feels-like, hourly, and daily min/max (e.g. 19°C -> 66.2°F).
  - **Client-Side Cache**: In-memory cache with 5-minute TTL keyed deterministically by coordinates (`${lat.toFixed(4)},${lon.toFixed(4)}`). Bypassed on force-refresh.
  - **Refresh Action**: "Refresh Weather" button triggers direct re-fetch for the active location.
  - **Loading & Error Guardrails**: Skeletons shown during in-flight requests, stale requests aborted on rapid location changes (`AbortController`), and friendly `ErrorState` with "Try Again" displayed on failure.
  - **Automated Verification**: Deterministic offline unit tests (`src/tests/weatherService.test.ts`) and live API verification script (`src/tests/liveVerification.ts`) all passed.
  - **Architectural Boundary**: GraphQL, AWS Lambda/API Gateway, Supabase PostgreSQL, Docker, and Cloudflare have **NOT** been added.

---

### Phase 3.1: Universal Location Search & Resolution
- **Status**: **Completed**
- **Goal**: Enable universal place-name search and direct coordinate input, resolving inputs into real coordinates and updating `activeLocation` atomically to eliminate decoupled name/coordinate bugs.
- **Completed Deliverables**:
  - **Dedicated Geocoding Service (`src/lib/geocodingService.ts`)**: Integrates Open-Meteo Geocoding REST API (`https://geocoding-api.open-meteo.com/v1/search`) without API keys.
  - **Direct Coordinate Parsing**: Parses decimal numbers (`22.5726, 88.3639` and `22.5726 88.3639`), negative coordinates, and cardinal formats (`° N, ° E, ° S, ° W`). Bypasses network call for direct coordinates.
  - **Coordinate Range Validation**: Strictly rejects out-of-range inputs (e.g. `100, 200`) with clear validation feedback before triggering network calls.
  - **Atomic ActiveLocation State**: Replaced placeholder fallback in `useLocationSystem.ts`. Name, country, administrative region (`admin1`), timezone, and coordinates are always updated together.
  - **Multiple Results Disambiguation (`LocationSection.tsx`)**: Renders an interactive results list when queries return multiple matching places (e.g., "Springfield, Illinois" vs. "Springfield, Missouri").
  - **Preserved Existing Features**: Preset buttons (London, Kolkata, Tokyo, etc.) and device GPS remain fully functional through the same atomic pipeline.
  - **Automated Verification**: Deterministic and live integration test suites passed (`geocodingService.test.ts` and `weatherService.test.ts`).

---

### Phase 4: Supabase PostgreSQL (Persistent Location Data & Geocoding Cache)
- **Status**: **Completed**
- **Goal**: Introduce Supabase as the application's persistent data layer without breaking existing weather, location-search, map, or UI systems.
- **Completed Deliverables**:
  - **Database Project Setup**: Connected Supabase PostgreSQL project in region `ap-south-1` (`weathergpt-db`).
  - **Security & Row Level Security (RLS)**:
    - Zero `service_role` secrets exposed to the frontend; uses strictly public `anon` key.
    - RLS enabled on all tables (`public.locations` and `public.geocoding_cache`).
    - Granular policies allow public SELECT and INSERT/UPSERT, while blocking public deletions.
  - **Database Schema**:
    - `public.locations`: Persists user-selected locations (`name`, `country`, `admin1`, `latitude`, `longitude`, `timezone`, `source`, `coord_key`, timestamps). Unique generated column `coord_key` (`ROUND(latitude, 4),ROUND(longitude, 4)`) enables clean deduplicated upserts.
    - `public.geocoding_cache`: Caches place-name search queries to arrays of normalized `GeocodingResult` objects (JSONB) with a 30-day TTL (`expires_at`).
  - **Reproducible Migration**: Saved permanent DDL script in `supabase/migrations/20260925000000_create_locations_and_geocoding_cache.sql`.
  - **Resilient Supabase Client (`src/lib/supabase.ts`)**: Singleton client with graceful degradation; returns `null` if credentials are not configured so builds and offline runs never crash.
  - **Service Layer (`src/lib/locationPersistenceService.ts`)**: Encapsulates all database interactions (`persistActiveLocation`, `getCachedGeocoding`, `setCachedGeocoding`, `getRecentPersistedLocations`).
  - **Geocoding Cache Integration (`src/lib/geocodingService.ts`)**: Checks Supabase cache before querying Open-Meteo REST API, and writes through results asynchronously.
  - **Non-Blocking Location Persistence (`src/hooks/useLocationSystem.ts`)**: Asynchronously persists selected device and manual locations without stalling UI or weather fetch transitions.
  - **Saved Locations UI (`LocationSection.tsx`)**: Displays recently saved locations from Supabase for fast one-click re-selection.
  - **Failure Resiliency**: If Supabase is offline or errors, geocoding and weather fall back cleanly to direct Open-Meteo network calls.
  - **Automated Verification**: Comprehensive test suite `src/tests/supabaseIntegration.test.ts` (8/8 tests passed). All 23 tests pass in `npm test`.

---

### Phase 4.1: Automatic Weather Refresh & Live Saved Locations Synchronization
- **Status**: **Completed**
- **Goal**: Implement automatic weather refresh while the page remains open, and synchronize Saved Locations immediately upon persistence without requiring page reload.
- **Completed Deliverables**:
  - **Automatic Weather Refresh (10 minutes)**: Sets up an active-location-tied timer in `src/app/page.tsx` polling Open-Meteo every 10 minutes (`AUTO_REFRESH_INTERVAL_MS = 600,000ms`).
  - **Unified Refresh Mechanism**: Manual "Refresh" button and automatic interval share `handleRefreshWeather` passing `forceRefresh: true` to bypass the 5-minute memory cache and update observations, hourly, and 7-day forecast atomically.
  - **Active Location Safety**: Timer resets cleanly when `activeLocation` coordinates change, preventing stale-location polling and duplicate timer accumulation.
  - **Tab Visibility Awareness**: Automatically pauses polling when the browser tab is hidden; refreshes immediately upon tab focus if ≥ 10 minutes have elapsed.
  - **Non-Destructive Error Handling**: If an auto or manual refresh encounters a network error while weather is already visible, existing weather is preserved and an inline notice is shown rather than unmounting the dashboard into `ErrorState`.
  - **Live Saved Locations Synchronization**: Lifted `savedLocations` to `useLocationSystem.ts`. Upon successful persistence, Supabase is queried immediately, updating the Saved list with confirmed records without page reload.
  - **Deduplication & Failure Resiliency**: Unique upsert on `coord_key` brings revisited locations to the top without duplicate buttons. If Supabase fails, core weather and search functions continue unaffected.
  - **Automated Verification**: Created `src/tests/phase41Verification.test.ts` (6/6 tests passed). All 29 tests pass in `npm test`.

---

### Step 1: Navigation Shell & Global Location Context (AccuWeather Expansion Foundation)
- **Status**: **Completed**
- **Goal**: Introduce a scalable multi-page navigation architecture without cluttering the existing working dashboard.
- **Completed Deliverables**:
  - **Global Location Context (`src/context/LocationContext.tsx`)**: Created top-level React Context providing centralized access to `activeLocation`, `savedLocations`, geolocation trigger, manual selection, geocoding resolution, unit conversion (`units`, `setUnits`, `toggleUnits`), and global search modal controls.
  - **Top Navigation Bar (`src/components/navigation/TopNav.tsx`)**: Responsive header with WeatherGPT Pro branding, categorized dropdown menus (Forecasts, Environment, Geohazards), direct Radar link, active location badge, reversible °C / °F toggle, mobile drawer, and one-handed mobile bottom dock.
  - **Global Location Search Modal (`src/components/navigation/LocationSearchModal.tsx`)**: Allows searching cities, inputting coordinates, using device GPS, or selecting saved locations from any route.
  - **Multi-Page Route Architecture**: Created dedicated sub-routes (`/hourly`, `/forecast`, `/maps`, `/air-quality`, `/astronomy`, `/activities`, `/earthquakes`, `/volcanoes`, `/alerts`, `/storms`, and `/nowcast`) synchronized with `activeLocation`.
  - **Dashboard Preservation**: Existing dashboard at `/` remains 100% intact with live weather, automatic 10-minute refresh, interactive Leaflet map, hourly timeline, 7-day outlook, location disambiguation, saved pills, and assistant chatbot.
  - **Automated Verification**: `npm run lint` (0 errors), `npm run build` (all 15 static routes generated cleanly), and all 29 automated tests passed.

---

### Phase 5: GraphQL API Layer & Application Gateway
- **Status**: **Completed**
- **Goal**: Establish the internal GraphQL API layer, strongly-typed SDL schema, domain resolvers, and application gateway without breaking existing frontend or database architecture.
- **Completed Deliverables**:
  - **Dependencies**: Integrated lightweight `graphql` and `graphql-yoga` engines without native compile requirements or bloated client-side cache stores.
  - **Schema Definition (SDL) (`src/graphql/schema/typeDefs.ts`)**: Defines strongly typed inputs (`CoordinatesInput`), weather outputs (`CurrentWeather`, `HourlyForecast`, `DailyForecast`, `WeatherReport`), location entities (`Location`), and assistant stub (`ChatResponse`).
  - **Celsius Source of Truth**: All weather data is returned strictly in normalized Celsius. Units argument removed; client display conversion remains in `LocationContext` and `temperature.ts`.
  - **Domain Resolvers (`src/graphql/resolvers/`)**:
    - `weatherResolvers.ts`: Implements `weatherByCoordinates` and `refreshWeather` by delegating directly to `weatherService.ts`. Validates coordinate boundaries (`[-90, 90]` latitude, `[-180, 180]` longitude) and raises `GraphQLError` with code `BAD_USER_INPUT`.
    - `locationResolvers.ts`: Implements `searchLocations` and `savedLocations` by delegating to `geocodingService.ts` and `locationPersistenceService.ts`.
  - **App Router Gateway Route Handler (`src/app/api/graphql/route.ts`)**: Serves `/api/graphql` dynamically with interactive GraphiQL in development.
  - **Lightweight Typed Client (`src/graphql/client/graphqlClient.ts` & `operations.ts`)**: Supports typed queries, mutations, error formatting, and `AbortSignal` cancellation over standard `fetch`.
  - **Weather Adapter (`src/graphql/client/weatherAdapter.ts`)**: Drop-in adapter `fetchWeatherViaGraphQL()` matching `fetchWeatherData()` signature, tested with 100% response parity and ready for future migration.
  - **Non-Destructive Dashboard Preservation**: The active dashboard (`src/app/page.tsx`) continues using the proven direct `fetchWeatherData()` service without disruption.
  - **Automated Verification**: Comprehensive automated test suite (`src/tests/graphql.test.ts`) covering 9 tests across schema, execution, error reporting, parity, and adapter. All 41 tests pass in `npm test`.

---

### Phase 6: AWS Serverless Setup
- **Status**: **Completed (Implemented & Verified Locally; Cloud Deployment Deferred)**
- **Goal**: Establish the AWS serverless backend foundation, API Gateway HTTP API v2 integration, Lambda execution entry point, EventBridge scheduled worker, structured observability, and secret management without disrupting local development or migrating the active dashboard prematurely.
- **Completed Deliverables**:
  - **Standalone Backend Service (`backend/`)**: Created clean TypeScript service configured with `tsconfig.json` and `package.json` targeting Node.js 20 and ARM64 architecture.
  - **Infrastructure as Code (IaC)**:
    - `backend/serverless.yml`: Production template for Serverless Framework v3/v4 defining HTTP API v2, Lambda handlers, EventBridge rule (`rate(30 minutes)`), and SSM Parameter Store secret references.
    - `backend/template.yaml`: AWS SAM / CloudFormation alternative providing a zero-lock-in native AWS infrastructure definition with least-privilege IAM roles.
  - **API Gateway v2 & Lambda GraphQL Handler (`backend/src/handlers/graphql.ts`)**:
    - Pure infrastructure wrapper reusing Phase 5 GraphQL SDL (`typeDefs.ts`), resolvers, and domain services (`weatherService.ts`, `geocodingService.ts`) with zero business logic duplication.
    - Implemented bidirectional event adapter (`backend/src/utils/apigateway.ts`) converting `APIGatewayProxyEventV2` to Web `Request` and Web `Response` to `APIGatewayProxyStructuredResultV2` with standard CORS headers.
  - **EventBridge Forecast Sync Worker (`backend/src/handlers/sync.ts`)**:
    - Lambda background worker scheduled for `rate(30 minutes)`.
    - Queries recently tracked locations from Supabase and triggers forced weather cache warming (`fetchWeatherData` with `forceRefresh: true`).
  - **CloudWatch Structured Observability (`backend/src/utils/logger.ts`)**:
    - Lightweight single-line JSON logger emitting timestamps, levels, service names, correlation IDs (`requestId`), and metadata ready for CloudWatch Logs Insights indexing.
  - **Security & Secret Hygiene**:
    - Audited all environment variables; isolated server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`) from browser bundles.
    - Zero AWS credentials required for local development.
  - **Automated Verification Suite (`frontend/src/tests/lambdaIntegration.test.ts`)**:
    - Simulated API Gateway v2 POST execution, CORS OPTIONS preflight, BAD_USER_INPUT coordinate validation error mapping, and EventBridge sync worker execution. All 4 tests pass.
  - **Local Development Preservation**:
    - Next.js development server, production build, lint, and all 42 automated tests across 7 suites pass with 100% success.
    - Dashboard at `src/app/page.tsx` remains strictly on direct `fetchWeatherData()` without premature migration.

---

### Phase 7: Weather Updates & Freshness Pipeline
- **Status**: **Completed (Implemented & Verified Locally; AWS Deployment Deferred)**
- **Goal**: Establish predictable rules for current weather freshness, hourly forecast freshness, daily forecast freshness, background cache warming, non-destructive manual/automatic refresh, in-flight request deduplication, and stale-while-revalidate failure resilience.
- **Completed Deliverables**:
  - **Tiered Meteorological Freshness Policy**:
    - Current conditions: 5 minutes (`CURRENT_TTL_MS = 300000`).
    - Hourly projection: 30 minutes (`HOURLY_TTL_MS = 1800000`).
    - 7-day daily outlook: 2 hours (`DAILY_TTL_MS = 7200000`).
    - Stale fallback retention: 24 hours (`STALE_FALLBACK_MAX_AGE_MS = 86400000`).
  - **In-Flight Request Deduplication**:
    - Concurrently initiated requests for identical coordinates await the same single in-flight network promise via `inFlightRequests` registry, preventing duplicate provider API traffic.
    - Decoupled caller `AbortSignal`s to allow individual cancellation without aborting shared fetches.
  - **Stale-While-Revalidate & Graceful Fallback**:
    - Returned valid cached data immediately when fresh.
    - If external network requests fail, automatically falls back to cached observation (`isStale: true`) rather than crashing or wiping displayed data.
  - **Non-Destructive Client Refresh Experience**:
    - Completely eliminated skeleton flashing during manual and automatic refreshes across `CurrentWeatherCard`, `HourlyForecastList`, and `DailyForecastList`.
    - Added subtle `isRefreshing` indicator and disabled state on the refresh button.
    - Preserved previous observations and surfaced non-destructive notice banners upon error.
  - **Automatic Refresh Synchronization**:
    - Configured 10-minute cadence (`AUTO_REFRESH_INTERVAL_MS = 600000`) with tab visibility detection (`document.visibilityState`).
    - Synchronized manual refresh timestamp with auto-refresh interval to prevent immediate redundant refreshes.
  - **Robust Background Forecast Sync Worker (`backend/src/handlers/sync.ts`)**:
    - Prepared for AWS EventBridge (`rate(30 minutes)`) while remaining 100% testable locally without AWS credentials.
    - Isolated per-location failures so an invalid coordinate or timeout does not crash the entire sync run.
    - Added automatic fallback to default preset locations if Supabase has zero stored locations.
    - Emitted structured `SyncResult` reporting `locationsAttempted`, `locationsSucceeded`, `locationsFailed`, `durationMs`, and per-location execution statuses.
  - **Supabase Cache Evaluation**:
    - Formally evaluated persistent weather snapshot/forecast tables (`weather_snapshots`, `forecast_hourly`, `forecast_daily`) and documented why creation remains deferred in favor of the high-performance in-memory cache and `geocoding_cache`.
  - **Automated Verification Suite (`frontend/src/tests/weatherFreshness.test.ts`)**:
    - Created 12 comprehensive automated tests covering all freshness tiers, cache hits, forced refresh, deduplication, background sync, partial failure isolation, cold cache rejections, and GraphQL parity.
    - Full test suite expanded to 57 automated tests across 8 suites with 100% pass rate.

---

### Phase 8: Simple Weather & Cloud Map
- **Status**: Pending

---

### Phase 9: Weather Chatbot
- **Status**: Pending

---

### Phase 10: Docker Containerization
- **Status**: Pending (Strictly deferred to Phase 10)

---

### Phase 11: Cloudflare Edge & HTTPS
- **Status**: Pending

---

### Phase 12: Testing & Final Verification
- **Status**: Pending
