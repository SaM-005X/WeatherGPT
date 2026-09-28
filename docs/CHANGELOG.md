# Changelog

All notable changes to the Simple Weather Web Application are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-09-28 — Phase 7: Weather Updates & Freshness Pipeline

### Added
- **Tiered Meteorological Freshness Policy (`weatherService.ts`)**:
  - Implemented explicit freshness windows: Current weather (5 min / `CURRENT_TTL_MS = 300000`), Hourly forecast (30 min / `HOURLY_TTL_MS = 1800000`), Daily forecast (2 hours / `DAILY_TTL_MS = 7200000`), and Stale fallback retention (24 hours / `STALE_FALLBACK_MAX_AGE_MS = 86400000`).
  - Added strongly-typed `CacheMetadata` to `WeatherReport` detailing `isCached`, `isFresh`, `isStale`, expiration dates, and age in seconds.
  - Added `getCacheStatus(lat, lon)` helper for zero-latency cache state inspection before render.
- **In-Flight Request Deduplication Engine (`weatherService.ts`)**:
  - Created `inFlightRequests` Map registry deduplicating concurrent network calls to Open-Meteo for identical coordinates.
  - Decoupled caller `AbortSignal`s via `attachAbortSignal()` to allow individual component cancellation without breaking shared network fetches or cache population.
  - Added `getInFlightRequestCount()` utility for monitoring and automated verification.
- **Stale-While-Revalidate & Graceful Failure Handling**:
  - Configured `fetchWeatherData()` to fall back to valid cached data with `isStale: true` when non-forced network requests fail, preventing null/empty states during transient provider outages.
  - Maintained clear separation: `forceRefresh: true` preserves error propagation so callers can surface non-destructive error notices.
- **Non-Destructive UI Refresh & State Decoupling**:
  - Decoupled `isWeatherLoading` (cold cache / new coordinate switch) from `isRefreshing` (background / manual update).
  - Updated `CurrentWeatherCard.tsx`, `HourlyForecastList.tsx`, and `DailyForecastList.tsx` to only render loading skeletons when `!data`. Active observations and forecasts remain visible throughout refreshes.
  - Added subtle "Updating..." indicator and disabled spinner state on the manual refresh button.
  - Fixed React 19 `react-hooks/purity` compliance for timestamp tracking refs.
- **Automatic Refresh Synchronization (`src/app/page.tsx`)**:
  - Configured 10-minute automatic polling interval with heartbeat check and tab visibility listener (`visibilitychange`).
  - Synchronized manual refresh execution with auto-refresh timer to reset the interval and prevent redundant immediate polling.
- **Robust Background Sync Pipeline (`backend/src/handlers/sync.ts`)**:
  - Implemented `syncLocations()` engine with per-location `try/catch` isolation so individual coordinate errors or timeouts do not crash the sync job.
  - Added automatic fallback to default preset locations (`PRESET_LOCATIONS`) when Supabase has zero stored records.
  - Emitted rich `SyncResult` reporting `locationsAttempted`, `locationsSucceeded`, `locationsFailed`, `durationMs`, and detailed execution records.
- **Automated Verification Suite (`frontend/src/tests/weatherFreshness.test.ts`)**:
  - Implemented 12 comprehensive automated tests covering all freshness tiers, cache hits, forced refresh, deduplication, background sync, partial failure isolation, cold cache rejections, and GraphQL parity.
  - Full test suite expanded to 57 automated tests across 8 suites with 100% pass rate.

### Milestone Status
- **Phase 7 Execution**: **COMPLETED (Implemented & Verified Locally; AWS Deployment Deferred)**.
- **Phase 8 Status (Simple Weather & Cloud Map)**: Ready for planning and execution.

---

## [1.1.0] - 2026-09-28 — Phase 6: AWS Backend & Deployment Foundation

### Added
- **AWS Serverless Backend Subsystem (`backend/`)**:
  - Initialized dedicated TypeScript serverless module targeting Node.js 20.x on ARM64 architecture (`architecture: arm64`).
  - Implemented `backend/src/handlers/graphql.ts` bridging Amazon API Gateway HTTP API v2 directly with GraphQL Yoga without modifying existing domain services.
  - Implemented bidirectional event transformer `backend/src/utils/apigateway.ts` adapting `APIGatewayProxyEventV2` to Web Fetch API standard `Request` and converting Web `Response` to `APIGatewayProxyStructuredResultV2` with full CORS preflight (`OPTIONS`) handling.
- **EventBridge Forecast Sync Worker (`backend/src/handlers/sync.ts`)**:
  - Implemented background scheduled Lambda handler responding to `rate(30 minutes)` rules.
  - Warmed hourly and 7-day weather forecasts by querying tracked locations from Supabase and executing `fetchWeatherData(lat, lon, { forceRefresh: true })`.
- **Structured CloudWatch Observability (`backend/src/utils/logger.ts`)**:
  - Created zero-dependency JSON logger generating single-line structured outputs including timestamp, log level, service identifier, correlation ID (`requestId`), duration in milliseconds, and error stacks.
- **Multi-Tool Infrastructure as Code (IaC)**:
  - Created `backend/serverless.yml` for Serverless Framework v3/v4 defining HTTP API v2 routes, Lambda functions, log group retention (7 days), and secure SSM parameter resolution (`${ssm:/weather-gpt/{stage}/*}`).
  - Created `backend/template.yaml` for AWS SAM / CloudFormation providing a vendor-agnostic infrastructure alternative with least-privilege IAM execution roles.
- **Environment Variable & Secret Isolation**:
  - Audited existing configuration; strictly isolated server credentials (`SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`) from client-side bundles.
  - Kept local development fully autonomous: no AWS credentials or local emulation required to run Next.js or execute `/api/graphql`.
- **Automated Verification Suite (`frontend/src/tests/lambdaIntegration.test.ts`)**:
  - Implemented automated offline test suite covering:
    1. API Gateway v2 POST `/graphql` query execution.
    2. CORS `OPTIONS` preflight headers.
    3. Coordinate validation error mapping (`BAD_USER_INPUT`).
    4. EventBridge scheduled forecast sync worker execution.
  - Updated `package.json` test scripts: `npm test` now runs 42 automated tests across 7 suites with 100% passing results.

### Preserved
- **Local Application Stability**:
  - Preserved Next.js frontend, development server, and production build (16/16 routes static/dynamic).
  - Maintained dashboard (`src/app/page.tsx`) on direct `fetchWeatherData()` without premature migration.

### Milestone Status
- **Phase 6 Execution**: **COMPLETED (Implemented & Verified Locally; Cloud Deployment Deferred)**.
- **Phase 7 Status (Weather Updates & Freshness Pipeline)**: Ready for planning and execution.

---

## [1.0.0] - 2026-09-28 — Phase 5: GraphQL Foundation & Application Gateway

### Added
- **Internal GraphQL Application Gateway (`/api/graphql`)**:
  - Implemented GraphQL Gateway route handler in `src/app/api/graphql/route.ts` using `graphql-yoga` and standard Web Fetch API.
  - Enabled interactive GraphiQL playground in development at `http://localhost:3000/api/graphql`.
- **GraphQL Schema Definition (`src/graphql/schema/typeDefs.ts`)**:
  - Strongly typed SDL schema covering `CoordinatesInput`, `Location`, `CurrentWeather`, `HourlyForecast`, `DailyForecast`, `WeatherReport`, and `ChatResponse`.
  - Removed `units` query argument; all meteorological data is strictly normalized and returned in Celsius. Display unit conversion remains in `LocationContext` and `temperature.ts`.
- **Domain Resolvers (`src/graphql/resolvers/`)**:
  - `weatherResolvers.ts`: Implemented `weatherByCoordinates` and `refreshWeather` by delegating directly to `weatherService.ts`. Added coordinate range validation (`[-90, 90]` latitude, `[-180, 180]` longitude) returning `GraphQLError` with code `BAD_USER_INPUT`.
  - `locationResolvers.ts`: Implemented `searchLocations` and `savedLocations` delegating to `geocodingService.ts` and `locationPersistenceService.ts`.
  - `assistantResolvers`: Prepared architectural contract stub for `askWeatherAssistant`.
- **Lightweight Typed GraphQL Client (`src/graphql/client/`)**:
  - `graphqlClient.ts`: Lightweight, zero-dependency client using standard `fetch` with `AbortSignal` cancellation and structured error parsing.
  - `operations.ts`: Typed GraphQL query and mutation documents (`GET_WEATHER_BY_COORDINATES`, `REFRESH_WEATHER_MUTATION`, `SEARCH_LOCATIONS_QUERY`, `SAVED_LOCATIONS_QUERY`).
  - `weatherAdapter.ts`: Drop-in adapter `fetchWeatherViaGraphQL()` matching `fetchWeatherData()` signature, tested with 100% response parity and ready for future migration.
- **Dashboard Preservation**:
  - Kept the active dashboard (`src/app/page.tsx`) operating on the proven direct `fetchWeatherData()` domain service with zero disruptions.
- **Verification Suite (`src/tests/graphql.test.ts`)**:
  - Added 9 automated tests validating schema validity, live weather queries, coordinate range validation, force refresh, geocoding search, saved locations, assistant stub, response parity, and adapter execution.
  - Updated `package.json`: `npm test` now runs 41 automated tests across 6 suites, all passing.

### Milestone Status
- **Phase 5 Execution**: **COMPLETED**.
- **Phase 6 Status (AWS Serverless Setup)**: Ready for planning and execution.

---

## [0.9.0] - 2026-09-26 — Step 1: Navigation Shell & Global Location Context

### Added
- **Global Location Context (`src/context/LocationContext.tsx`)**:
  - Encapsulated `activeLocation`, `savedLocations`, geolocation trigger, manual selection, geocoding resolution, and error handling into a top-level React Context.
  - Lifted unit preference state (`units: 'metric' | 'imperial'`, `setUnits`, `toggleUnits`) into the context so °C / °F conversion stays perfectly synchronized across all routes.
  - Added global location search modal controller (`isSearchModalOpen`, `setIsSearchModalOpen`, `openLocationSearch`).
- **Top Navigation Bar (`src/components/navigation/TopNav.tsx`)**:
  - Implemented responsive desktop navigation bar with WeatherGPT Pro branding, categorized dropdown menus (Forecasts, Environment, Geohazards), and direct Radar & Maps link.
  - Added header-level reversible unit toggle (°C / °F) and active location indicator pill.
  - Implemented mobile navigation drawer and fixed bottom navigation dock for one-handed mobile browsing.
- **Global Location Search Modal (`src/components/navigation/LocationSearchModal.tsx`)**:
  - Enables instant location search, device GPS triggering, preset selection, and saved location retrieval from any route in the application without redirecting back to the home page.
- **Multi-Page Route Architecture**:
  - Created dedicated sub-routes: `/hourly`, `/forecast`, `/maps`, `/air-quality`, `/astronomy`, `/activities`, `/earthquakes`, `/volcanoes`, `/alerts`, `/storms`, and `/nowcast`.
  - All routes subscribe directly to the shared `LocationContext`, maintaining coordinate synchronization across page transitions.
- **Dashboard Preservation (`src/app/page.tsx`)**:
  - Preserved the existing working weather dashboard in its entirety, including live weather, automatic 10-minute refresh, interactive Leaflet map, hourly timeline, 7-day outlook, location disambiguation, saved pills, and assistant chatbot.

### Milestone Status
- **Step 1 (Navigation Shell & Shared Location Context)**: **COMPLETED**.
- **Phase 5 Status (GraphQL API Gateway Foundation)**: Ready for execution.

---

## [0.8.1] - 2026-09-25 — Phase 4.1: Automatic Weather Refresh & Live Saved Locations Synchronization

### Added
- **Automatic Weather Refresh Lifecycle (`src/app/page.tsx`)**:
  - Implemented 10-minute (`AUTO_REFRESH_INTERVAL_MS = 600,000ms`) automatic weather polling for the current active location.
  - Unified manual and automatic refresh under a shared `handleRefreshWeather` handler passing `forceRefresh: true` to bypass the 5-minute client cache and retrieve fresh observations and forecast.
  - Active Location Safety: The refresh timer automatically tracks `[activeLocation.latitude, activeLocation.longitude]`. Changing location cancels the previous location's timer immediately and initializes a fresh 10-minute timer for the new coordinates.
  - Tab Visibility Awareness: Automatically pauses polling when the browser tab is hidden (`document.hidden`). When the tab returns to `visible`, if ≥ 10 minutes have elapsed, it performs an immediate refresh and resets the timer.
  - In-flight Debounce & Spinner: Disabled rapid repeated clicks on `↻ Refresh` during in-flight fetches and added a spinning animation indicator.
  - Non-Destructive Refresh Error Notice: If an automatic or manual refresh encounters a network error while weather is already visible, the previous weather report, forecast, and timestamps remain displayed on screen, and an inline dismissible notice banner informs the user rather than unmounting the dashboard into `ErrorState`.
- **Immediate Saved Locations UI Synchronization (`src/hooks/useLocationSystem.ts` & `src/components/location/LocationSection.tsx`)**:
  - Eliminated the race condition where `LocationSection` requested Supabase saved locations before asynchronous persistence had committed to the database.
  - Lifted `savedLocations` state into `useLocationSystem.ts` as the single source of truth for location data.
  - Upon successful resolution of `persistActiveLocation` (`true`), `useLocationSystem` immediately queries `getRecentPersistedLocations(5)` to retrieve the database-confirmed saved list with exact ordering and Supabase IDs.
  - The Saved Locations UI pills update immediately on screen without requiring a page reload or selecting another location.
  - Deduplication: Retained coordinate-based unique upsert on `coord_key`, moving revisited locations to the top without duplicate buttons.
  - Failure Fallback: If Supabase fails, `savedLocations` remains unchanged and core weather/search/map functionality continues unaffected.
- **Verification Suite**:
  - Added automated test suite `src/tests/phase41Verification.test.ts` (6 tests validating cache bypass, atomic payload, timestamp consistency, immediate saved location synchronization, coordinate deduplication, and non-blocking failure fallback).
  - Updated `package.json` test scripts (`npm test` now runs 29 automated tests across Weather Service, Geocoding, Supabase, and Phase 4.1).

### Milestone Status
- **Phase 4.1 Execution**: **COMPLETED**.
- **Phase 5 Status**: **NOT STARTED** (Awaiting user instruction).

---

## [0.8.0] - 2026-09-25 — Phase 4: Supabase Integration & Persistent Location Data

### Added
- **Supabase PostgreSQL Persistent Data Layer**:
  - Connected project `weathergpt-db` in `ap-south-1`.
  - Configured `@supabase/supabase-js` client singleton (`src/lib/supabase.ts`) with safe non-blocking fallback if offline or unconfigured.
  - Strictly exposed ONLY the public `anon` key; zero privileged secrets or `service_role` keys are in client code.
- **Relational Database Tables & Row Level Security (RLS)**:
  - `public.locations`: Stores resolved locations (`name`, `country`, `admin1`, `latitude`, `longitude`, `timezone`, `source`, `coord_key`, timestamps). Unique generated column `coord_key` (`ROUND(latitude, 4),ROUND(longitude, 4)`) enables clean deduplicated upserts.
  - `public.geocoding_cache`: Caches place-name search queries to arrays of normalized `GeocodingResult` objects (JSONB) with a 30-day expiration window (`expires_at`).
  - Enabled RLS on all tables with explicit public SELECT and INSERT/UPDATE policies; public deletions are prohibited.
  - Created reproducible migration script in `supabase/migrations/20260925000000_create_locations_and_geocoding_cache.sql`.
- **Location Persistence Service (`src/lib/locationPersistenceService.ts`)**:
  - Added clean abstraction functions: `persistActiveLocation`, `getCachedGeocoding`, `setCachedGeocoding`, `getRecentPersistedLocations`, and `normalizeQuery`.
  - Wrapped all queries in error guards guaranteeing non-blocking fallback.
- **Geocoding Cache Integration (`src/lib/geocodingService.ts`)**:
  - `searchGeocodingLocations` performs a cache-first lookup before calling the Open-Meteo REST API, and caches fresh results with a 30-day TTL.
- **Saved Locations UI (`LocationSection.tsx`)**:
  - Added "Saved:" pills row displaying recent persisted locations from Supabase for instant one-click re-selection.
- **Verification Suites**:
  - Added comprehensive test suite `src/tests/supabaseIntegration.test.ts` (8 tests covering connection, insert, retrieve, cache miss/hit, multi-location isolation, coordinate persistence, invalid query rejection, and graceful failure).
  - Updated `package.json` test scripts (`npm test` now runs 23 tests across Weather Service, Geocoding, and Supabase).

### Milestone Status
- **Phase 4 Execution**: **COMPLETED**.
- **Phase 5 Status**: **NOT STARTED** (Awaiting user instruction).

---

## [0.7.0] - 2026-09-25 — Phase 3.1: Universal Location Search & Resolution

### Fixed
- **Decoupled Location Name & Coordinate Bug**: Eliminated placeholder fallback in `useLocationSystem.ts` where unknown text searches changed the location label while leaving previous coordinates active.
- **Atomic Location Synchronization**: Enforced that `name`, `latitude`, `longitude`, `country`, `admin1`, and `timezone` are always updated atomically as one synchronized unit across Location UI, Map, and Weather Service.

### Added
- **Dedicated Geocoding Service (`src/lib/geocodingService.ts`)**:
  - Implemented client for Open-Meteo Geocoding REST API (`https://geocoding-api.open-meteo.com/v1/search`).
  - Added direct coordinate parser supporting comma (`22.5726, 88.3639`), space (`22.5726 88.3639`), negative numbers, and cardinal directions (`° N, ° E, ° S, ° W`).
  - Added strict coordinate boundary validation: rejects out-of-range coordinates (`[-90, 90]` latitude, `[-180, 180]` longitude) without invoking external APIs.
- **Disambiguation UI (`LocationSection.tsx`)**:
  - Added visual search feedback ("Searching...").
  - Added interactive disambiguation list when multiple locations match a query (e.g. "Springfield, Illinois" vs. "Springfield, Missouri"), showing city name, administrative region/state, country, and coordinate preview.
  - Added clear user error banners for failed searches and out-of-range coordinates.
- **Verification Suites**:
  - Added automated test suite `src/tests/geocodingService.test.ts` covering coordinate parsing, out-of-range rejection, model creation, and live searches for Norway, Moscow, Springfield, Kolkata, and direct coordinate inputs.

### Milestone Status
- **Phase 3.1 Execution**: **COMPLETED**.
- **Phase 4 Status**: **NOT STARTED** (Awaiting user instruction).

---

## [0.6.0] - 2026-09-25 — Phase 3: Live/Current Weather Integration
 
### Added
- **Open-Meteo REST API Integration (`src/lib/weatherService.ts`)**:
  - Implemented coordinate-based weather fetching using standard Open-Meteo forecast endpoint (`https://api.open-meteo.com/v1/forecast`).
  - Automatically queries `current`, `hourly`, and `daily` metrics with `timezone=auto` and 7-day forecast horizon.
  - Coordinate validation: Enforces valid ranges for latitude (-90 to +90) and longitude (-180 to +180).
- **Application Normalization Layer**:
  - Raw Open-Meteo responses are normalized into clean, typed application models: `CurrentWeather`, `HourlyForecast`, `DailyForecast`, and `WeatherReport` / `WeatherData`.
  - Stored temperatures are strictly normalized in Celsius, ensuring compatibility with the Phase 2.1 reversible conversion utility (`src/lib/temperature.ts`).
  - Observation timestamp (`recordedAt`) is accurately calculated from Open-Meteo local observation time and UTC offset seconds.
  - 24-Hour Horizon: Hourly forecast extracts 24 hours starting from the current local hour.
  - 7-Day Outlook: Daily forecast maps index 0 to "Today" and subsequent days to short weekdays (e.g. "Fri", "Sat").
- **Centralized WMO Weather Code Mapping (`src/lib/weatherCodes.ts`)**:
  - Created single source of truth for mapping WMO weather interpretation codes (0–99) to `WeatherCondition` union and descriptive text (e.g. "Clear sky", "Partly cloudy", "Dense drizzle", "Thunderstorm").
  - Includes safe fallback for unmapped/invalid codes (`UNKNOWN` / "Unknown conditions").
- **In-Memory Client Cache**:
  - Implemented 5-minute cache keyed deterministically by coordinates (`${lat.toFixed(4)},${lon.toFixed(4)}`).
  - Automatically returns cached reports (`isCached: true`) for repeat requests within the TTL window.
  - Bypassed on force-refresh (`isCached: false`).
- **Live UI Synchronization (`src/app/page.tsx`)**:
  - Connected `activeLocation` (`latitude`, `longitude`) to `fetchWeatherData`.
  - Request cancellation: Rapid location switching cancels in-flight requests via `AbortController`.
  - Skeletons displayed during fetch states (`WeatherCardSkeleton`, hourly/daily skeletons).
  - Clean error handling with `ErrorState` and retry trigger.
  - Dedicated "↻ Refresh" action on Current Weather card triggering live cache bypass.
- **Verification Suites**:
  - Deterministic offline unit tests (`src/tests/weatherService.test.ts`): All 7 test suites passed.
  - Live API verification script (`src/tests/liveVerification.ts`): Confirmed distinct real weather for London, Kolkata, Tokyo, device coordinates (22.56, 88.40), unit conversion (19°C -> 66.2°F), and cache bypass.
- **Boundary Preservation**:
  - Mock weather removed from main display.
  - GraphQL, AWS Lambda/API Gateway, Supabase PostgreSQL, Docker, and Cloudflare have **NOT** been added.

### Milestone Status
- **Phase 3 Execution**: **COMPLETED**.
- **Phase 4 Status**: **NOT STARTED** (Awaiting user instruction).

---

## [0.5.0] - 2026-09-25 — Phase 2.1: Frontend Stabilization & Light Theme Polish

### Added & Fixed
- **Temperature & Unit Conversion Utility (`src/lib/temperature.ts`)**:
  - Implemented standard conversion formula `°F = (°C × 9/5) + 32`.
  - Keeps underlying weather data strictly in Celsius (no data mutation on unit switch).
  - Immediate, synchronized conversion applied to current temperature (19°C -> 66.2°F), feels-like (18°C -> 64.4°F), hourly forecast, and daily minimum/maximum temperatures.
  - Added unit conversion tests in `src/tests/temperature.test.ts` (all passed).
- **Natural Light Theme System**:
  - Converted the interface from a dark navy "AI dashboard" look into a clean, human-designed light weather-app aesthetic.
  - Page background set to `#f8fafc` (`bg-slate-50`), cards to pure white (`bg-white`) with subtle borders (`border-slate-200`) and minimal shadows (`shadow-xs`).
  - Preserved the entire visual hierarchy and layout: Header -> Controls -> Location -> Current Weather -> Map -> Hourly -> 7-Day -> Chatbot -> Footer.
  - Removed artificial neon glows, excessive pill cards, and gradients.
- **Input State & Hydration Verification**:
  - Hardened timestamps against SSR/client locale mismatch (`suppressHydrationWarning`).
  - Verified Weather Assistant input behavior across idle, focused, typing, blurred, Enter-key submission, and Send button click states with high-contrast readable text.
- **Boundaries Confirmed**:
  - Current weather remains mock/preview data.
  - Live weather API integration has **NOT** started.
  - GraphQL, Supabase, Lambda/AWS, Docker, and Cloudflare have **NOT** been added.

### Milestone Status
- **Phase 2.1 Execution**: **COMPLETED**.
- **Phase 3 Status**: **NOT STARTED** (Awaiting user instruction).

---

## [0.4.0] - 2026-09-24 — Phase 2: Location System

### Added
- **Unified Location Model (`src/types/location.ts`)**:
  - Defined `ActiveLocation` with fields `latitude`, `longitude`, `accuracy` (in meters), `name`, `country`, `source` (`'device' | 'manual'`), and `timestamp`.
  - Added structured `GeolocationError` types for permission denial, unavailable position, timeout, and unsupported browsers.
- **Location Hook (`src/hooks/useLocationSystem.ts`)**:
  - Implemented single source of truth for active location.
  - Browser Geolocation flow: Strictly user-initiated single-shot `getCurrentPosition` (10s timeout, no continuous tracking).
  - Manual selection handler: Parses direct coordinate inputs (`lat, lon`) and fuzzy-matches against preset locations.
  - Human-friendly error translation avoiding raw browser exception exposure.
- **Preset Locations Catalog (`src/lib/presetLocations.ts`)**:
  - Curated preset coordinates for London, Kolkata, New York, Tokyo, Paris, and Sydney for instant testing and manual selection.
- **Enhanced UI Components**:
  - `LocationSection.tsx`: Displays active location name, latitude, longitude, accuracy in meters, source badge, manual input, preset pills, and dismissible error banners.
  - `Header.tsx`: Displays active location name and source badge with direct jump to location controls.
  - `WeatherMapInternal.tsx` & `WeatherMap.tsx`: Dynamically synchronizes map center, marker popup, and renders an accuracy radius circle (`L.circle`) when device geolocation provides an accuracy radius.
- **Automated Verification Script (`src/tests/locationSystem.test.ts`)**:
  - Validates default location, preset catalog, case-insensitive query matching, and coordinate parsing.

### Testing & Verification
- `npm run lint`: ESLint passed with 0 errors.
- `npm run build`: Production build succeeded with 0 errors.
- Unit verification (`tsx src/tests/locationSystem.test.ts`): All 4 test suites passed.
- Boundaries confirmed: No weather API calls, no GraphQL, no AWS, and no Supabase code introduced.

### Milestone Status
- **Phase 2 Execution**: **COMPLETED**.
- **Phase 3 Status**: **NOT STARTED** (Awaiting user instruction).

---

## [0.3.0] - 2026-09-24 — Phase 1: Native Frontend Foundation
- Bootstrapped native Next.js 16 frontend with Tailwind CSS v4 and Leaflet base map.
- Built reusable UI components and isolated preview datasets.

---

## [0.2.0] - 2026-09-24 — Phase 0 Corrections: Architecture Simplification
- Simplified caching, weather freshness, and guardrails.

---

## [0.1.0] - 2026-09-24 — Initial Phase 0 Documentation
- Initial architecture, roadmap, and documentation setup.
