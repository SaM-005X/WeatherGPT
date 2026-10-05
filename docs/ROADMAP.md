# WeatherGPT — Roadmap

> **CURRENT FINAL STATE: v1.14.0 (PRODUCTION READY)**
> - **Roadmap Progress**: Phases 0 through 12 are **100% COMPLETED**.
> - **Frontend Packaging**: Multi-stage standalone Next.js container on `node:22-alpine` (port 3000).
> - **Hosting & Edge**: Deployed to Render Web Service ([https://weathergpt-frontend.onrender.com](https://weathergpt-frontend.onrender.com)) with Cloudflare Edge proxy ([https://weathergpt.app](https://weathergpt.app)).
> - **Production Backend**: AWS AppSync GraphQL API (`lae4htbgzfbcvjnczbgzio3w6q`) in `us-east-1` with direct Lambda resolver (`WeatherFunction`), EventBridge sync (`ForecastSyncFunction`), and < 2ms fallback.
> - **Database**: Supabase PostgreSQL (`locations`, `geocoding_cache`) with Row Level Security.
> - **AI Chatbot**: Groq Cloud running Qwen 3.8 27B via Next.js `/api/chat` with strict guardrails and deterministic meteorological fallback.
> - **Verification Baseline**: 100% pass across all 18 test suites, 0 ESLint errors/warnings, clean Turbopack build across 18 routes.

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
[Phase 2.1] Frontend Stabilization & Visual Polish (COMPLETED)
    │
    ▼
[Phase 3] Weather Service Integration (COMPLETED)
    │
    ▼
[Phase 3.1] Universal Location Search & Resolution (COMPLETED)
    │
    ▼
[Phase 4] Supabase Persistent Locations & Geocoding Cache (COMPLETED)
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
[Phase 6] AWS Serverless Setup (COMPLETED — Verified Locally; Cloud Deployment Deferred)
    │
    ▼
[Phase 7] Weather Updates & Freshness Pipeline (COMPLETED)
    │
    ▼
[Phase 7.2] Final Stabilization / Performance & Abort Handling (COMPLETED)
    │
    ▼
[Phase 8] Simple Weather & Cloud Map (COMPLETED)
    │
    ▼
[Phase 8.5] AWS AppSync Integration (COMPLETED)
    │
    ▼
[Phase 9] Weather Chatbot (COMPLETED)
    │
    ▼
[Stage 5 & 6] Interactive Radar & Precipitation Nowcast (COMPLETED)
    │
    ▼
[Stage 7] Wind Patterns, Cloud Cover & Satellite Layers (COMPLETED)
    │
    ▼
[Stage 8] Severe Weather Alerts, Thunderstorm Tracking & Resilience (COMPLETED)
    │
    ▼
[Stage 9] Geohazards Architecture — Earthquakes, Volcanoes & Tsunamis (COMPLETED)
    │
    ▼
[Phase 10] Docker Containerization (COMPLETED)
    │
    ▼
[Phase 11] Cloudflare Edge & HTTPS (COMPLETED)
    │
    ▼
[Phase 12] Final Release Gate & Production Readiness (COMPLETED — 100% Roadmap Sign-Off)
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
  - **Top Navigation Bar (`src/components/navigation/TopNav.tsx`)**: Responsive header with WeatherGPT branding, categorized dropdown menus (Forecasts, Environment, Geohazards), direct Radar link, active location badge, reversible °C / °F toggle, mobile drawer, and one-handed mobile bottom dock.
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

### Phase 7.2: Final Stabilization / Performance & Abort Handling
- **Status**: **Completed**
- **Goal**: Harden concurrent request deduplication, caller cancellation isolation (`AbortController`), loading state stability, and non-destructive error resilience to ensure rock-solid production-grade reliability across rapid route transitions, tab visibility events, and simulated network interruptions.
- **Completed Deliverables**:
  - **Caller Cancellation Isolation**:
    - Decoupled individual caller `AbortSignal`s via `attachAbortSignal()` in `src/lib/weatherService.ts`.
    - When a caller aborts (e.g. React StrictMode unmount, rapid tab switch, or navigation), the underlying wire request to Open-Meteo continues in-flight for concurrent callers without throwing an unhandled `AbortError`.
    - Verified that concurrent callers resolve valid data and the memory cache populates cleanly for instantaneous subsequent retrieval (< 20ms).
  - **Rapid Location Switching & In-Flight Cleanup**:
    - Safely prunes the `inFlightRequests` Map registry upon request completion or failure.
    - Tested rapid location switches (e.g. Kolkata -> London -> Kolkata) ensuring previous aborted promises do not corrupt subsequent active fetches.
  - **Loading-State Stabilization & Non-Destructive Refresh**:
    - Enforced strict separation between initial data load (`!data` rendering skeletons) and subsequent background or manual refreshes (`isRefreshing` indicator).
    - Completely eliminated skeleton flashing during manual and auto refreshes across `CurrentWeatherCard`, `HourlyForecastList`, and `DailyForecastList`.
  - **Stale-While-Revalidate Error Fallback**:
    - If external provider queries fail during non-forced refreshes, gracefully falls back to cached observation data with `isStale: true` for up to 24 hours (`STALE_FALLBACK_MAX_AGE_MS = 86400000`) rather than destroying rendered UI.
  - **Comprehensive Verification Suites**:
    - Added `src/tests/freshnessBugInvestigation.test.ts` (8 regression tests covering refresh timestamp advancement, 10-minute cadence, stale clearing, visibility toggles, and metadata calculation).
    - Added `src/tests/inFlightAbortRegression.test.ts` (3 regression tests validating abort isolation, cache population after isolated abort, and rapid sequential location switching).
    - Expanded test baseline to **68 / 68 automated tests passing across 10 test suites**.
    - Passed **0 TypeScript errors**, **0 ESLint errors/warnings**, and successful Next.js production build (`next build` generates 16 routes cleanly).
  - **Deployment Boundary Adherence**:
    - AWS cloud deployment remains strictly deferred / unprovisioned.
    - Docker containerization remains strictly deferred to Phase 10.
    - Cloudflare remains a future deployment target.

---

### Phase 8: Simple Weather & Cloud Map
- **Status**: **Completed**
- **Goal**: Integrate spatial visualization with OpenStreetMap, active-location coordinates and GPS accuracy, live RainViewer Doppler precipitation radar, and Open-Meteo cloud cover metrics into the existing map without disrupting core weather features.
- **Completed Deliverables**:
  - **Core Data Enrichment (`src/lib/weatherService.ts`)**:
    - Added `cloud_cover` parameter to Open-Meteo REST query (`current=...,cloud_cover`).
    - Normalized into typed `CurrentWeather.cloudCover` (number 0–100%).
    - Preserved 5-minute in-memory caching and tiered freshness guarantees.
  - **Keyless RainViewer Doppler Radar Service (`src/lib/rainViewerService.ts`)**:
    - Queries RainViewer API v2 `/v2/index.json` to extract latest radar observation timestamps and tile paths without API keys.
    - Caches metadata for 5 minutes with in-flight request deduplication.
    - Implemented safe stale fallback and request timeout protection via `AbortSignal`.
    - Constructs standard Leaflet tile URL templates (`{z}/{x}/{y}`).
    - Configured standard GIS zoom constraints (`maxNativeZoom: 7`, `maxZoom: 18`) to allow smooth client-side tile upscaling without 404 tile errors.
  - **Map UI Integration (`WeatherMap.tsx`, `WeatherMapInternal.tsx`)**:
    - Standard OpenStreetMap base tile layer dynamically synchronized with `activeLocation`.
    - Active location marker with accuracy circle (`L.circle`) for device geolocation.
    - User-facing "📡 Radar: ON / OFF" toggle button with loading spinner, pulsing active indicator, and error isolation.
    - Attached/detached RainViewer Doppler radar tile layer with version-tracked race-condition protection.
    - Added floating Cloud Cover & Weather Status HUD (bottom-left) rendering percentage and condition descriptions.
  - **Radar Button / Leaflet Zoom Overlap Corrective Patch**:
    - Repositioned top control bar to `top-2.5 left-14 right-2.5 gap-2`, providing a clean 12px separation from Leaflet's native `+` / `−` zoom controls (`left: 10px..44px`).
    - Both controls remain 100% accessible, unobstructed, and clickable across desktop and mobile viewports.
  - **Multi-Instance Support**:
    - Active across both Dashboard map (`src/app/page.tsx`, `h-72`) and dedicated maps page (`src/app/maps/page.tsx`, `h-[500px]`).
  - **Automated Verification**:
    - Dedicated test suites `src/tests/rainViewerService.test.ts` (9/9 tests) and `src/tests/mapUiIntegration.test.ts` (9/9 tests).
    - Expanded test coverage to the 85-test Phase 8 baseline, now 86 core assertions after the map UI patch, with the main `npm test` command still executing only the original 68 tests across 10 suites (standalone verification scripts and newly added suites exist outside the standard `npm test` script).
    - Passed **0 TypeScript errors**, **0 ESLint errors/warnings**, and clean Next.js production build (`next build`).

---

### Phase 8.5: AWS AppSync Integration
- **Status**: **Completed**
- **Goal**: Introduce AWS AppSync as the managed serverless GraphQL entry point for production while preserving GraphQL Yoga for local development and maintaining existing domain services (`weatherService.ts`, `geocodingService.ts`, `locationPersistenceService.ts`) as the single source of business logic.
- **Detailed Sub-Step Sequence**:
  - **Phase 8.5.1 — Architecture & Repository Audit**: **Completed** (Systematic audit of existing frontend, backend, Supabase, and GraphQL implementations).
  - **Phase 8.5.1-C — Corrective Architecture Audit**: **Completed** (Reconciled architectural direction: SAM as canonical IaC, `serverless.yml` frozen at Phase 6 foundation, domain services retained as business logic, thin Lambda adapters, no premature DynamoDB/S3).
  - **Phase 8.5.2 — Documentation Synchronization**: **Completed** (Synchronized `ARCHITECTURE.md`, `ROADMAP.md`, `GRAPHQL.md`, and `AWS.md`).
  - **Phase 8.5.3 — AppSync Schema & IaC Definition**: **Completed** (Defined canonical `schema.graphql` and SAM `backend/template.yaml` AppSync GraphQL API, API_KEY & IAM auth, and data source resources for pilot resolver `weatherByCoordinates`).
  - **Phase 8.5.4 — Lambda Resolver Implementation**: **Completed** (Implemented thin `weatherFunction` Lambda adapter delegating directly to `weatherService.ts`).
  - **Phase 8.5.5 — Offline AppSync Simulation Tests**: **Completed** (Executed deterministic offline tests validating AppSync request/response event mapping and resolver delegation, 8/8 tests passing).
  - **Phase 8.5.6 — Remaining Resolver Parity**: **Completed** (Preserved location services on client/direct Supabase; aligned AppSync schema with operational endpoints).
  - **Phase 8.5.7 — Real AWS Deployment & Cloud Verification**: **Completed** (Executed CloudFormation change set `samcli-deploy1790757616`, verified `CREATE_COMPLETE`, extracted AppSync endpoints, executed live test query returning HTTP 200 OK without errors).
  - **Phase 8.5.8 — Frontend GraphQL Adapter Wiring**: **Completed** (Created `src/lib/api/graphqlClient.ts`, updated `.env.local` & `.env.example`, wired dashboard `page.tsx` to `fetchWeatherByCoordinates`, verified loading states, error handling, live AppSync fetching, and 5/5 automated integration tests).
  - **Phase 8.5.9 — Full Regression Verification**: **Completed** (Ran complete end-to-end regression test suite, verified live dashboard, radar map, saved locations, and automated refresh).
  - **Phase 8.5.10 — Final Review & Git Checkpoint**: **Completed** (Performed comprehensive architecture review, updated changelog, and established confirmed Git checkpoint).
- **Preserved Architectural Invariants**:
  - `weatherService.ts` remains the meteorological domain logic layer (in-memory cache, tiered freshness, deduplication, Open-Meteo REST calls).
  - `geocodingService.ts` and `locationPersistenceService.ts` remain the location domain logic layers.
  - Next.js Dashboard wired to `fetchWeatherByCoordinates` in Phase 8.5.8, targeting live AppSync in production with direct service fallback.
  - Downstream features (Phase 9 Chatbot, Phase 10 Docker, Phase 11 Cloudflare, Phase 12 Verification, and domain expansions like Air Quality, Astronomy, Severe Weather Alerts, Nowcast, Storms) remain fully preserved.

---

### Phase 9: Weather Chatbot with Groq Cloud (Qwen 3.8 27B) & Lifestyle Guardrails
- **Status**: **Completed**
- **Completed Deliverables**:
  - **Core Assistant Engine (`src/lib/weatherAssistant.ts`)**:
    - Powered by Groq Cloud API running `qwen/qwen3.8-27b` via OpenAI-compatible chat completions (`https://api.groq.com/openai/v1/chat/completions`) without heavy vector databases or LangChain.
    - Generates system prompt with live meteorological context injection (`temperature`, `feelsLike`, `condition`, `humidity`, `windSpeed`, `precipitation`, `cloudCover`, forecasts).
    - Enforces strict weather-only guardrails; automatically rejects off-topic queries (coding, trivia, recipes, history, math, creative writing) with standard polite refusal.
    - Deterministic meteorological grounding engine providing accurate clothing, umbrella, and outdoor activity recommendations when `GROQ_API_KEY` is omitted, placeholder, or rate-limited (HTTP 429).
  - **Next.js API Route (`src/app/api/chat/route.ts`)**:
    - Dedicated Route Handler accepting `messages` (limited to last 3-4 turns max) and `weatherContext`.
    - Returns standardized `{ reply, isOffTopic, source }` JSON responses.
  - **Interactive Dashboard UI (`src/components/WeatherChat.tsx` / `src/components/chatbot/WeatherAssistant.tsx`)**:
    - Embedded into the main dashboard, dynamically grounded in `activeLocation` and live `weatherData`.
    - Features quick prompt chips (`"Do I need an umbrella today?"`, `"What should I wear?"`, `"Best time for a walk?"`).
    - Scrollable message history with auto-scroll to bottom, loading indicator dots, Enter-key submission, and guardrail badge highlighting.
  - **Comprehensive Verification Suite (`src/tests/weatherChatbot.test.ts`)**:
    - 5/5 automated tests validating prompt formatting, on-topic grounded queries, off-topic rejection, warm weather adaptation, and `/api/chat` Route Handler execution.
    - Clean compilation with 0 TypeScript errors, 0 ESLint warnings, and successful Next.js production build (`next build`).


---

---

### Stage 5 & 6: Interactive RainViewer Radar & Open-Meteo Precipitation Nowcast
- **Status**: **Completed**
- **Completed Deliverables**:
  - **Live Doppler Radar & Animation Controls (`src/lib/rainViewerService.ts` & `WeatherMapInternal.tsx`)**:
    - Multi-frame RainViewer API v2 timeline frame extraction with sequence ordering (`radar.past` and `radar.nowcast`).
    - Floating playback dock with Play/Pause animation timer (850ms cycle), step backward/forward buttons, timeline range scrubber, and local/UTC timestamps.
    - Opacity slider (10% to 100%) and instant show/hide layer visibility toggle.
    - Zero memory leak teardown of Leaflet tile layers on unmount or radar deactivation.
  - **Open-Meteo 15-Minute Precipitation Nowcast (`/nowcast` & `src/lib/weatherService.ts`)**:
    - Integration with Open-Meteo `minutely_15=precipitation,precipitation_probability,weather_code` across 8 intervals (next 120 minutes).
    - Meteorological normalization with intensity categorization (`dry`, `light`, `moderate`, `heavy`, `violent`).
    - 5-minute caching with request deduplication and graceful stale fallback.
    - Live `/nowcast` view with summary badges (Horizon, Max Probability, Current Intensity, 2h Total), trajectory banner, visual bar projection chart, and detailed 15-minute interval table.
  - **Automated Verification Suite (`src/tests/radarNowcast.test.ts` & `src/tests/rainViewerService.test.ts`)**:
    - 8/8 nowcast and 9/9 radar unit tests passing. Clean `npm run lint` and `npm run build`.

---

### Stage 7: Wind Patterns, Cloud Cover & Satellite Imagery Layers
- **Status**: **Completed**
- **Completed Deliverables**:
  - **Wind Service & Vector Marker (`src/lib/windService.ts` & `WeatherMapInternal.tsx`)**:
    - Extracted Open-Meteo wind speed (km/h & mph), gusts, and 360° direction angle.
    - Implemented 16-point compass cardinal conversion (`degreesToCardinal`), Beaufort scale calculation (0–12), and directional SVG arrow markers on Leaflet map.
    - Added Wind HUD metrics badge (speed, gusts, cardinal direction, Beaufort level) to active location point metric card.
  - **Expanded Cloud Cover Layer & Metric HUD (`WeatherMapInternal.tsx`)**:
    - Expanded Cloud Metric HUD displaying cloud cover percentage, semantic cloud category (`Clear`, `Partly Cloudy`, `Mostly Cloudy`, `Overcast`), and estimated cloud base altitude (~800m to >3,500m).
    - Added toggleable Cloud Cover visualization overlay with opacity control slider.
  - **Satellite Imagery Layer (`src/lib/satelliteService.ts` & `WeatherMapInternal.tsx`)**:
    - Created `satelliteService.ts` supporting keyless, free, open satellite tile providers: **Esri World Imagery** and **NASA GIBS Terra TrueColor**.
    - Integrated provider selector, opacity slider (20% to 100%), and proper map attribution strings.
  - **Unified Map Layer Switcher (`WeatherMapInternal.tsx`)**:
    - Top-left layer selection control bar allowing users to toggle and combine: Base Map (OpenStreetMap), Doppler Radar (RainViewer), Wind HUD & Vectors, Cloud Overlay, and Satellite Imagery.
  - **Automated Verification Suite (`src/tests/windSatelliteLayers.test.ts`)**:
    - 7/7 automated unit tests passed. Passed `npm run lint` with 0 errors and `npm run build`.

---

### Stage 7.1: Map Polish — Live Cloud Tiles, Regional Wind Vector Grid & Status Card Synchronization
- **Status**: **Completed**
- **Completed Deliverables**:
  - **Live Cloud Overlay with NASA GIBS Tiles (`rainViewerService.ts` & `WeatherMapInternal.tsx`)**:
    - Mounted real cloud imagery using NASA GIBS MODIS Terra Cloud Fraction Day (`MODIS_Terra_Cloud_Fraction_Day`) with clean alpha transparency.
    - Updated opacity dynamically via `setOpacity` to eliminate layer flickering on slider interaction.
    - Added `buildSatelliteInfraredTileUrlTemplate` and `getCloudTileConfig` helpers in `rainViewerService.ts`.
  - **Regional Animated Wind Vector Grid (`windService.ts` & `WeatherMapInternal.tsx`)**:
    - Built a 5x5 regional grid of animated streamlines across the visible map bounds with GPU-accelerated CSS flow/pulse animations matching wind speed.
    - Grid dynamically updates on map pan and zoom (`moveend`).
    - Coexists with the central location badge pin; cleanly unmounts on toggle off.
  - **Harmonized Map Status Cards (`WeatherMap.tsx` & `maps/page.tsx`)**:
    - Synchronized the 4 cards below the map (Base Map, Doppler Radar, Cloud/Satellite Layer, Geohazards) via lifted `LayerState`.
    - Active layers light up in sky-blue; idle layers maintain uniform neutral styling (`border-slate-200 bg-white/70`).
  - **Testing & Verification**:
    - 8/8 unit tests passing in `src/tests/windSatelliteLayers.test.ts`.
    - Clean `npm run lint` (0 errors, 0 warnings), all 13 test suites passing (`npm test`), and clean production build (`npm run build`).

---

### Stage 8: Severe Weather Alerts, Thunderstorm Tracking & Service Resilience
- **Status**: **Completed**
- **Completed Deliverables**:
  - **Network Timeout & Retry Resilience (`rainViewerService.ts` & `backend/template.yaml`)**:
    - Increased RainViewer fetch timeout from 5000ms to 10000ms with a transparent single-retry fallback on transient network disconnects.
    - Increased AWS SAM `WeatherFunction` execution timeout from 10s to 25s for multi-hop cold-start resilience.
  - **Severe Weather Alerts System (`alertsService.ts` & `/alerts` Page)**:
    - US NWS GeoJSON active alerts query for US locations (`https://api.weather.gov/alerts/active`).
    - Open-Meteo synoptic severe risk derivation (wind gusts, torrential rain, extreme heat/cold, convective storm codes) for international locations.
    - Normalized alerts schema with 4 severity levels (`Extreme`, `Severe`, `Moderate`, `Minor`), urgency, instruction, and validity timestamps.
    - In-memory 5-minute cache with deduplication and stale fallback.
    - Live `/alerts` page with color-coded severity cards (Red for Extreme/Severe, Amber for Moderate, Green for No Active Advisories) and expandable action details drawer.
  - **Thunderstorm & Convective Tracking (`stormService.ts`, `/storms` Page & Leaflet Layer)**:
    - Analyzes Open-Meteo convective codes (WMO 95, 96, 99; squalls and heavy showers) and calculates lightning potential score (0–100) and risk level (`None`, `Moderate`, `High`, `Severe`).
    - Regional storm cell generator projecting convective clusters within 15–50km with bearing, distance, and motion vectors.
    - Added `⚡ Storms` layer to Leaflet map (`WeatherMapInternal.tsx`) with animated pulsing lightning shockwave markers (`L.divIcon`), interactive storm cell popups, and HUD risk badges.
    - Live `/storms` page with real-time convective index gauge, metric breakdown cards, and safety guidelines.
  - **Testing & Quality Assurance**:
    - Comprehensive unit test suite `src/tests/alertsStorms.test.ts` (7/7 tests passed).
    - Verified 0 ESLint errors/warnings (`npm run lint`), all test suites passing, and clean Next.js production build (`npm run build`).

---

### Stage 9: Geohazards Architecture (Earthquakes, Volcanoes & Tsunamis)
- **Status**: **Completed**
- **Goal**: Build live geohazards domain services, UI views (`/earthquakes`, `/volcanoes`, `/tsunamis`), and isolated Leaflet map overlay layers.
- **Completed Deliverables**:
  - **Earthquakes Service (`earthquakeService.ts`) & `/earthquakes` UI**:
    - Real-time USGS GeoJSON feed integration (`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson` with `all_day.geojson` fallback).
    - Haversine distance & cardinal bearing calculations to active user location.
    - Color-graded magnitude severity badges (`minor`, `moderate`, `strong`, `major`) and depth indicators.
    - Magnitude (M2.5+, M4.5+, M6.0+) and scope filters (Local <500km, Regional <1500km, Global).
    - 5-minute memory cache & in-flight request deduplication.
  - **Volcanoes Service (`volcanoService.ts`) & `/volcanoes` UI**:
    - Ingested Smithsonian GVP / USGS Volcanic Hazards public reports.
    - Normalized Aviation Color Codes (`GREEN`, `YELLOW`, `ORANGE`, `RED`) and active eruption vs. unrest distinction.
    - Calculated distance and bearing to active user location.
    - 15-minute memory cache & deduplication.
  - **Tsunamis Service (`tsunamiService.ts`) & `/tsunamis` UI**:
    - NOAA / PTWC active tsunami message feed ingestion (`tsunami.gov`).
    - Standard status level normalization (`WARNING`, `ADVISORY`, `WATCH`, `INFORMATION`, `NO_ACTIVE`).
    - Actionable emergency safety guidelines engine and affected ocean basins list.
    - 5-minute memory cache & deduplication.
  - **Leaflet Map Overlays (`WeatherMapInternal.tsx`)**:
    - Toggleable top-left map controls buttons `🌋 Earthquakes` and `🌋 Volcanoes`.
    - Concentric SVG circle markers for quakes scaled to magnitude; emoji markers with Aviation Color Code rings for volcanoes.
    - Isolated Leaflet `LayerGroup` instances executing clean `clearLayers()` on toggle off and unmount.
  - **Automated Test Suite**:
    - `src/tests/geohazards.test.ts` covering spatial math, GeoJSON parsing, color codes, status levels, caching, deduplication, and layer unmount safety (6/6 passed).

---

### Stage 10: Environmental, Astronomical & Lifestyle Intelligence
- **Status**: **Completed**
- **Goal**: Implement live environmental air pollution tracking, solar/lunar astronomical ephemeris, and multi-variable outdoor lifestyle comfort scoring.
- **Completed Deliverables**:
  - **Air Quality & Environmental Health Service (`airQualityService.ts` & `/air-quality` Page)**:
    - Queried Open-Meteo Air Quality REST API (`https://air-quality-api.open-meteo.com/v1/air-quality`).
    - Normalized US AQI, European AQI, PM2.5, PM10, Carbon Monoxide, Nitrogen Dioxide, Sulphur Dioxide, and Ozone in standard units (`µg/m³`).
    - Standardized EPA AQI 5-tier classification (`Good`, `Moderate`, `Sensitive`, `Unhealthy`, `Hazardous`) with actionable civilian and sensitive-group health advisories.
    - Dominant pollutant identifier and EPA spectrum gauge.
    - 5-minute memory TTL cache with in-flight request deduplication.
    - Responsive `/air-quality` dashboard with live observation grid and location synchronization.
  - **Sun & Moon Astronomy Service (`astronomyService.ts` & `/astronomy` Page)**:
    - Queried Open-Meteo Forecast daily ephemeris (`sunrise`, `sunset`, `daylight_duration`).
    - Real-time client solar arc progress tracking (`Pre-Dawn`, `Daylight`, `Post-Dusk`) with solar noon and golden hour intervals.
    - Synodic month lunar cycle calculations (`29.53058867` days period referenced to Jan 6, 2000 epoch).
    - Geometric Moon illumination percentage math and 8 distinct Moon phase classifications (`New Moon`, `Waxing Crescent`, `First Quarter`, `Waxing Gibbous`, `Full Moon`, `Waning Gibbous`, `Last Quarter`, `Waning Crescent`).
    - 15-minute memory TTL cache with in-flight request deduplication.
    - Responsive `/astronomy` dashboard with solar arc progress bar, golden hour cards, and lunar phase visual card.
  - **Weather Activity Suitability Engine (`activityService.ts` & `/activities` Page)**:
    - Evaluated 5 outdoor activities (Running, Cycling, Hiking, Beach/Swimming, Stargazing) with multi-variable comfort scoring (0–100) based on temperature, rain rate, wind speed, cloud cover, humidity, and daylight status.
    - Standardized rating tiers: `Poor` (<40), `Fair` (40–59), `Good` (60–79), and `Ideal` (80–100).
    - Itemized positive and negative weather drivers for each activity.
    - Stargazing daylight lockout guardrail (score forced to 0 during daylight).
    - 5-minute memory TTL cache with in-flight deduplication and pure evaluation mode (`customMetrics`).
    - Responsive `/activities` dashboard with Top Recommended Hero card, microclimate strip, and category filters.
  - **Automated Test Suite**:
    - Created comprehensive unit and integration test suite `src/tests/environmentActivities.test.ts` (4/4 test phases passed).
    - Added `test:env` script and integrated into main `npm test`.

---

### System, Database Persistence & Freshness Audit (Pre-Phase 10 Gate)
- **Status**: **Completed**
- **Goal**: Perform comprehensive end-to-end audit verifying Supabase persistence vs in-memory caching boundary, client 10-minute refresh pipeline, AWS AppSync/GraphQL failover, and build/test health across all 18 routes prior to containerization.
- **Audit Findings & Confirmations**:
  - **Supabase Persistence & RLS**:
    - Audited `public.locations` table: verified upsert deduplication on generated `coord_key` (`ROUND(latitude, 4),ROUND(longitude, 4)`).
    - Audited `public.geocoding_cache` table: verified 30-day TTL queries (`expires_at > now()`) resolve cleanly and bypass Open-Meteo REST calls on hits.
    - Verified Row Level Security (RLS) enforcement: public `anon` role has `SELECT`, `INSERT`, `UPDATE` access while `DELETE` is strictly blocked.
    - Verified non-blocking fallback in `locationPersistenceService.ts`: gracefully degrades to memory when Supabase credentials are missing or fail.
  - **Deferred Relational Tables & In-Memory Storage Boundary**:
    - Verified 0 queries across codebase against `weather_snapshots`, `forecast_hourly`, and `forecast_daily`.
    - Confirmed live weather, geohazards (earthquakes, volcanoes, tsunamis), and environmental services (air quality, astronomy, activities) strictly utilize in-memory tiered caches (5m to 15m) with request deduplication (`inFlightRequests`, `inFlightAirQuality`, `inFlightAstronomy`) and zero memory leaks.
  - **10-Minute Polling & Data Freshness Engine**:
    - Verified `AUTO_REFRESH_INTERVAL_MS = 600000` (10 minutes) polling logic in `frontend/src/app/page.tsx` running on a 30s visibility check.
    - Confirmed location changes immediately cancel previous intervals and initiate a fresh 10-minute cycle.
    - Verified `document.visibilityState` pauses polling in hidden tabs and triggers an immediate catch-up refresh on focus if ≥ 10m elapsed.
    - Confirmed non-destructive SWR updates: background and manual refreshes update data atomically without skeleton flickers or layout shift.
    - Audited `backend/src/handlers/sync.ts`: confirmed per-location `try/catch` error isolation in EventBridge scheduled batch sync.
  - **AWS AppSync & GraphQL Gateway**:
    - Audited `frontend/src/lib/api/graphqlClient.ts`: confirmed schema alignment (`cloudCover: Int`) and fast-fail fallback to direct `weatherService.ts` within < 1ms on timeout or 5xx.
  - **Test Suite, Lint & Build Verification**:
    - `npm run lint`: 0 errors, 0 warnings.
    - `npm test`: 100% tests passing across all suites.
    - `npm run build`: Turbopack compiled successfully across all 18 routes with zero errors.

---

### Phase 10: Docker Containerization
- **Status**: **Completed**
- **Goal**: Create and verify production multi-stage `Dockerfile.frontend` generating a standalone Next.js container image.
- **Completed Deliverables**:
  - **Next.js Standalone Configuration**:
    - Configured `output: 'standalone'` in `frontend/next.config.ts`.
    - Preserved Turbopack compilation rules and TypeScript path aliases.
  - **Docker Ignore Optimization**:
    - Created `frontend/.dockerignore` and root `.dockerignore` excluding `.git`, `node_modules`, `.next`, `out`, `.env*.local`, test artifacts, and IDE configurations.
  - **Multi-Stage Production Container (`frontend/Dockerfile.frontend`)**:
    - Stage 1 (`deps`): Ingests frozen lockfile on `node:22-alpine`, installs dependencies with `libc6-compat`.
    - Stage 2 (`builder`): Ingests source, exposes public `NEXT_PUBLIC_*` build arguments, and builds standalone application.
    - Stage 3 (`runner`): Creates non-root system user/group `nodejs:nextjs` (UID/GID 1001). Copies standalone output, static assets, and public directory. Binds to `0.0.0.0:3000` via `node server.js`.
  - **Local Smoke Testing & Verification**:
    - Built image `weathergpt-frontend:latest` (~65MB compressed Alpine footprint).
    - Executed container smoke test with port mapping.
    - Verified HTTP 200 responses across all 18 routes and static chunk assets (`/_next/static/chunks/...`).
    - Verified clean startup logs with 0 errors and startup latency < 1ms in local smoke tests.
  - **Host Tooling & Test Suite Parity**:
    - Preserved host commands (`npm run dev`, `npm test`, `npm run build`).
    - Confirmed 0 ESLint errors/warnings, 100% pass across all test suites, and clean host build.

---

### Phase 11: Cloudflare Edge & HTTPS
- **Status**: **Completed**
- **Goal**: Configure DNS management, Full (Strict) SSL termination, static asset edge CDN caching, and production security headers.
- **Completed Deliverables**:
  - **Next.js Production Edge Headers (`frontend/next.config.ts`)**:
    - Configured HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`).
    - Configured defense-in-depth headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`.
    - Applied 1-year immutable caching (`public, max-age=31536000, immutable`) for static media assets, enabling Cloudflare edge caching (`HIT`).
    - Added dynamic route protection (`Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache`) for `/api/*` to bypass edge cache.
  - **Cloudflare & Render Production Topology (`docs/CLOUDFLARE.md`)**:
    - Documented DNS configuration (`@` and `www` CNAME pointing to Render Web Service `weathergpt-frontend.onrender.com` with Orange Cloud proxy enabled).
    - Detailed Full / Full (Strict) SSL mode architecture utilizing Render's automated managed origin TLS certificates.
    - Specified edge cache rules matrix (Static `HIT` vs Dynamic `DYNAMIC`).
    - Documented troubleshooting procedures for Cloudflare Errors 525, 520, 521, and 522, along with `curl` verification commands.
  - **Deployment & Architecture Documentation**:
    - Updated `docs/DEPLOYMENT.md` to reference the completed Phase 11 edge architecture.
    - Added Section 19: Edge & CDN Architecture to `docs/ARCHITECTURE.md`.

---

### Phase 12: Final Release Gate, Docker Runtime Alignment & Production Readiness Sign-Off
- **Status**: **Completed (100% Roadmap Completion Sign-Off)**
- **Goal**: Execute the final release sign-off: upgrade Docker runtime to Node.js 22 LTS, eliminate all build-time deprecation and cache-control notices, verify sub-millisecond cache latency and AppSync fallback (< 2ms) across all 18 routes, update documentation, and tag official v1.14.0 production release.
- **Completed Deliverables**:
  - **Docker Runtime Alignment (Node.js 22 LTS Base Image)**:
    - Upgraded `frontend/Dockerfile.frontend` across all stages (`deps`, `builder`, `runner`) from `node:20-alpine` to `node:22-alpine`.
    - Fully resolved `@supabase/supabase-js` deprecation notice.
  - **Build Notice Suppression & Native Chunk Cache Management (`frontend/next.config.ts`)**:
    - Removed redundant custom `/_next/static/:path*` Cache-Control header, allowing Next.js 16 to natively manage immutable static chunk caching without emitting build warnings.
    - Preserved production security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) and dynamic `/api/*` no-cache rules.
  - **Full Test Suite & Build Parity Verification**:
    - `npm run lint`: 0 errors, 0 warnings.
    - `npm test`: 100% green across all 18 test suites.
    - `npm run build`: Turbopack compiled successfully across all 18 routes with zero warnings.
  - **Endpoint Latency & Failover Audit (`src/tests/finalEndpointAudit.ts`)**:
    - Validated sub-millisecond in-memory cache responses across core domain services: `/` (0.35ms), `/air-quality` (0.01ms), `/astronomy` (0.04ms), `/activities` (0.53ms), `/earthquakes` (0.02ms), `/volcanoes` (0.06ms), `/tsunamis` (0.01ms), `/alerts` (0.02ms), `/storms` (0.01ms), `/nowcast` (0.03ms), and `/maps` (0.01ms).
    - Validated AppSync overload fallback to direct meteorological domain service in 1.58ms (< 2ms requirement).
    - Validated `/api/chat` Route Handler guardrail rejection in 2.15ms.
  - **Verified Live Deployment Endpoints**:
    - Documented active Cloudflare Anycast edge (`https://weathergpt.app`) and Render Web Service (`https://weathergpt-frontend.onrender.com`).
  - **Release Tag & Sign-Off**:
    - Final production sign-off for **WeatherGPT v1.14.0**.

---

## Placeholder Routes & Scope Clarification

During **Step 1 (Navigation Shell & Global Location Context)**, the navigation header (`TopNav.tsx`) and sub-routes were created to establish a multi-page shell. Their current implementation status is:

| Route | UI Title | Stated Data Source | Current Code Status | Canonical Classification |
| :--- | :--- | :--- | :--- | :--- |
| **`/nowcast`** | Precipitation Nowcast | Open-Meteo `minutely_15` | **Fully Implemented** (Live 15-min projection, bar chart, badges) | **Core Feature (Completed Stage 5/6)** |
| **`/alerts`** | Severe Weather Alerts | US NWS & Open-Meteo Synoptic | **Fully Implemented** (Live color cards, drawer, 5m cache) | **Core Feature (Completed Stage 8)** |
| **`/storms`** | Convective & Thunderstorm | Open-Meteo WMO & Convective | **Fully Implemented** (Live gauge, regional cells, map layer) | **Core Feature (Completed Stage 8)** |
| **`/earthquakes`** | Global Earthquake Tracker | USGS GeoJSON Feed | **Fully Implemented** (Live quakes feed, filters, map layer) | **Core Feature (Completed Stage 9)** |
| **`/volcanoes`** | Volcano Activity & Eruptions | Smithsonian GVP / USGS | **Fully Implemented** (Live volcanoes feed, aviation codes, map layer) | **Core Feature (Completed Stage 9)** |
| **`/tsunamis`** | Tsunami Advisories | NOAA / PTWC Bulletin | **Fully Implemented** (Live advisories banner, ocean basins, safety rules) | **Core Feature (Completed Stage 9)** |
| **`/activities`** | Weather Activities & Lifestyle | Multi-variable comfort rules | **Fully Implemented** (Live 5-activity scoring engine, tiers, drivers, filters) | **Core Feature (Completed Stage 10)** |
| **`/air-quality`**| Air Quality & Environment | Open-Meteo Air Quality | **Fully Implemented** (Live US AQI, 6 pollutants, EPA advisories, 5m cache) | **Core Feature (Completed Stage 10)** |
| **`/astronomy`** | Sun & Moon Astronomy | Open-Meteo Ephemeris & Synodic | **Fully Implemented** (Live solar arc bar, golden hours, lunar phase math) | **Core Feature (Completed Stage 10)** |

> **Notice on Legacy UI Badges**:
> The earlier placeholder routes have now all been converted to fully operational live domain services and responsive dashboards. All navigation links in `TopNav.tsx` now connect to active, tested production views.
