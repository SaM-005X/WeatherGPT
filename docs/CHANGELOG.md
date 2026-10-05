# Changelog

All notable changes to WeatherGPT are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.14.1] - 2026-10-05 — Documentation Canonicalization & Production Deployment Synchronization

### Documentation Maintenance
- **Comprehensive Documentation Audit & Canonicalization**:
  - Audited all 12 project Markdown documentation files (`README.md`, `docs/PROJECT_OVERVIEW.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/GRAPHQL.md`, `docs/AWS.md`, `docs/SUPABASE.md`, `docs/DOCKER.md`, `docs/DEPLOYMENT.md`, `docs/CLOUDFLARE.md`, `docs/TROUBLESHOOTING.md`, `docs/CHANGELOG.md`).
  - Reconciled documentation against verified live production infrastructure: Render Web Service Docker hosting (`https://weathergpt-frontend.onrender.com`), Cloudflare Edge (`https://weathergpt.app`), AWS AppSync (`us-east-1` API ID `lae4htbgzfbcvjnczbgzio3w6q`), Supabase PostgreSQL, and Groq Cloud Qwen 3.8 27B inference.
- **Environment Variable Canonicalization**:
  - Standardized the AppSync frontend GraphQL URL on the exact variable consumed by the application client: `NEXT_PUBLIC_APPSYNC_GRAPHQL_URL` (paired with `NEXT_PUBLIC_APPSYNC_API_KEY`).
  - Standardized the Weather Assistant LLM secret on `GROQ_API_KEY` (server-side only in `/api/chat`, never exposed in client bundles or Docker build args).
- **Edge & Origin Alignment (`docs/CLOUDFLARE.md`, `docs/DEPLOYMENT.md`)**:
  - Aligned Cloudflare documentation with the Render Web Service origin (CNAME routing, automated Render origin TLS certificate lifecycle, Full (Strict) SSL mode).
  - Aligned caching documentation with Next.js 16 native immutable static chunk caching and eliminated obsolete custom `/_next/static/*` header references.
- **Cross-Link Validation & Local Link Eradication**:
  - Removed all local Windows filesystem links (`file:///c:/...`) and restored repository-relative Markdown links.
  - Added clean, bidirectional "Related Documentation" navigation across technical architecture, deployment, and troubleshooting runbooks.
- **Metric Qualification**:
  - Accurately distinguished local smoke-test benchmarks (e.g. sub-millisecond in-memory cache lookups, container initialization times) from cloud production service expectations.

---

## [1.14.0] - 2026-10-05 — Phase 12: Final Release Gate, Docker Runtime Alignment & Production Readiness Sign-Off

### Added
- **Final Release Endpoint & Latency Audit (`frontend/src/tests/finalEndpointAudit.ts`)**:
  - Validated sub-millisecond in-memory cache responses across all 11 core domain services: `/` (0.35ms), `/air-quality` (0.01ms), `/astronomy` (0.04ms), `/activities` (0.53ms), `/earthquakes` (0.02ms), `/volcanoes` (0.06ms), `/tsunamis` (0.01ms), `/alerts` (0.02ms), `/storms` (0.01ms), `/nowcast` (0.03ms), and `/maps` (0.01ms).
  - Validated AWS AppSync overload simulation fallback to direct domain service in 1.58ms (< 2ms requirement).
  - Validated `/api/chat` Route Handler guardrail rejection in 2.15ms with strict lifestyle topic protection.
  - Integrated into main `npm test` script as a permanent release gate verification.
- **Verified Live Deployment Endpoints (`docs/DEPLOYMENT.md`)**:
  - Documented live Cloudflare Edge CDN endpoint (`https://weathergpt.app`) with Anycast DNS and Full (Strict) SSL.
  - Documented live Render Docker Web Service host (`https://weathergpt-frontend.onrender.com`).
  - Documented AWS AppSync production GraphQL endpoint (`https://64xz24nnqbdktigtxjwstte234.appsync-api.us-east-1.amazonaws.com/graphql`).
  - Documented Supabase PostgreSQL database (`https://pwhulhaywzdsggmgweyu.supabase.co`).

### Changed
- **Docker Base Image Runtime Alignment (`frontend/Dockerfile.frontend`)**:
  - Upgraded base image from `node:20-alpine` to `node:22-alpine` in all stages (`deps`, `builder`, `runner`).
  - Resolved `@supabase/supabase-js` deprecation notice while maintaining ultra-lean Alpine container footprint.
  - Synchronized `docs/DOCKER.md` multi-stage specification with Node 22 LTS.
- **Next.js Cache-Control Header Hygiene (`frontend/next.config.ts`)**:
  - Removed custom Cache-Control header rule for `/_next/static/:path*` to let Next.js 16 manage immutable static chunk caching natively.
  - Completely suppressed build-time `Custom Cache-Control headers detected` warning notices during development and production builds.
  - Preserved global production security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) and dynamic `/api/*` no-cache rules.

### Verified
- **Full Test Suite Parity**: 100% green pass across all 18 test suites (`npm test`).
- **ESLint Cleanliness**: 0 errors, 0 warnings (`npm run lint`).
- **Turbopack Build Cleanliness**: 100% clean compilation generating all 18 application routes with 0 warnings (`npm run build`).
- **Roadmap Completion**: Marked Phase 12 as COMPLETED with 100% roadmap sign-off in `docs/ROADMAP.md`.

---

## [1.13.0] - 2026-10-04 — Phase 11: Cloudflare Edge & Production HTTPS

### Added
- **Next.js Production Edge & Security Headers (`frontend/next.config.ts`)**:
  - Implemented HTTP Strict Transport Security: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` for browser-enforced HTTPS.
  - Implemented defense-in-depth headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin`.
  - Added 1-year immutable caching (`public, max-age=31536000, immutable`) for `/_next/static/*` and static media assets (`.svg`, `.png`, `.jpg`, `.ico`, `.woff2`) enabling Cloudflare Edge `HIT` responses.
  - Added dynamic route protection headers (`no-store, no-cache, must-revalidate` + `Pragma: no-cache`) for `/api/*` to guarantee fresh, un-cached responses for live weather telemetry, geohazards, and AI chatbot inference.
- **Dedicated Cloudflare Operational Runbook (`docs/CLOUDFLARE.md`)**:
  - Documented DNS configuration: root (`@`) and `www` CNAME/A records with `Proxied (Orange Cloud)` status.
  - Documented Full (Strict) SSL/TLS architecture, Cloudflare Origin CA certificate installation, and automated HTTP-to-HTTPS redirect.
  - Established Edge Cache Rules matrix distinguishing static chunk caching (`HIT`) from dynamic application routes (`DYNAMIC`).
  - Detailed diagnostic procedures for Cloudflare Errors 525, 520, 521, and 522 along with edge curl verification commands.
- **Architecture & Deployment Documentation**:
  - Updated `docs/DEPLOYMENT.md` Section 2 with Phase 11 edge proxy synchronization.
  - Added Section 19: Edge & CDN Architecture to `docs/ARCHITECTURE.md` and updated Section 1 architectural principles.
  - Marked Phase 11 as completed in `docs/ROADMAP.md`.

---

## [1.12.0] - 2026-10-04 — Phase 10: Production Docker Containerization

### Added
- **Next.js Standalone Configuration**: Configured `output: 'standalone'` in `frontend/next.config.ts` to automatically bundle traced production dependencies.
- **Multi-Stage Production Dockerfile (`frontend/Dockerfile.frontend`)**:
  - Implemented 3-stage architecture: `deps` (Alpine 3.20 + Node 20, libc6-compat, `npm ci`), `builder` (source ingest, `NEXT_PUBLIC_*` build-args, Turbopack build), and `runner` (minimal Alpine runtime).
  - Configured non-root system user and group `nodejs:nextjs` with UID/GID 1001 for unprivileged container security.
  - Set runtime parameters `PORT=3000`, `HOSTNAME="0.0.0.0"`, `NODE_ENV=production`, and `NEXT_TELEMETRY_DISABLED=1`.
  - Configured standalone entrypoint `["node", "server.js"]` serving pre-rendered static assets and dynamic API routes.
- **Docker Build Context Optimization**: Created `frontend/.dockerignore` and root `.dockerignore` excluding `.git`, `node_modules`, `.next`, `out`, `.env*.local`, test artifacts, documentation, and OS metadata.
- **Documentation Updates**:
  - `docs/DOCKER.md`: Documented multi-stage architecture, build/run/cleanup commands, and runtime configuration matrix.
  - `docs/DEPLOYMENT.md`: Added production Docker deployment instructions and updated target deployment topology.
  - `docs/ARCHITECTURE.md`: Added Section 18: Container Runtime Architecture detailing multi-stage topology, variable lifecycle separation, and runtime metrics.
  - `docs/ROADMAP.md`: Marked Phase 10 as completed with full deliverable breakdown.

### Changed
- Containerized application footprint reduced to ~64.8MB compressed Alpine content size (~265MB uncompressed disk usage).

### Verified
- Built image `weathergpt-frontend:latest` via `docker build -t weathergpt-frontend:latest -f frontend/Dockerfile.frontend frontend`.
- Verified local container execution with 0 startup errors (`Ready in 0ms`, `Running next.config took 1.1ms`).
- Verified HTTP 200 health and content delivery across all 18 application routes and static chunks (`/_next/static/chunks/...`).
- Verified test suite, lint, and build parity on host machine: 0 ESLint errors/warnings, 100% test pass across all 17 test suites, and clean host compilation via `npm run build`.

---

## [1.11.1] - 2026-10-04 — System, Database Persistence & Ingestion Freshness Audit

### Audited & Verified
- **Supabase Persistence & RLS Operational Boundary**:
  - Audited `supabase/migrations/20260925000000_create_locations_and_geocoding_cache.sql` and `frontend/src/lib/locationPersistenceService.ts`.
  - Confirmed `public.locations` table performs deduplicated upserts on generated `coord_key` (`ROUND(latitude, 4),ROUND(longitude, 4)`).
  - Confirmed `public.geocoding_cache` enforces 30-day TTL queries (`expires_at > now()`) bypassing Open-Meteo REST calls on cache hits.
  - Verified Row Level Security (RLS) enforcement: public `anon` role is granted `SELECT`, `INSERT`, and `UPDATE` permissions while `DELETE` remains strictly blocked.
  - Verified non-blocking fallback in `locationPersistenceService.ts` to ensure unconfigured or failing Supabase connections degrade gracefully without fatal exceptions.
- **Relational Storage vs In-Memory Caching Boundary**:
  - Confirmed deferred tables (`weather_snapshots`, `forecast_hourly`, `forecast_daily`) are non-existent and zero runtime code attempts to query them.
  - Confirmed live weather, geohazards (earthquakes, volcanoes, tsunamis), and environmental services (air quality, astronomy, activities) strictly operate within in-memory tiered caches (5m to 15m TTL) with request deduplication (`inFlightRequests`, `inFlightAirQuality`, `inFlightAstronomy`) and zero memory leakage across navigation.
- **10-Minute Polling & Freshness Engine Verification**:
  - Verified `AUTO_REFRESH_INTERVAL_MS = 600000` (10 minutes) polling logic in `frontend/src/app/page.tsx` running on a 30s visibility check.
  - Confirmed changing `activeLocation` immediately cancels previous polling timers and initiates a fresh 10-minute cycle for new coordinates.
  - Verified `document.visibilityState` pauses polling in hidden tabs and triggers an immediate catch-up refresh on focus if ≥ 10m elapsed.
  - Confirmed non-destructive SWR updates: background and manual refreshes update data atomically without skeleton flickers or layout shift.
  - Audited `backend/src/handlers/sync.ts`: confirmed per-location `try/catch` error isolation in EventBridge scheduled batch sync.
- **AWS AppSync & GraphQL Gateway**:
  - Audited `frontend/src/lib/api/graphqlClient.ts`: confirmed schema alignment (`cloudCover: Int`) and fast-fail fallback (< 1ms) to direct `weatherService.ts` on cold-start aborts or HTTP 5xx responses.
- **Test Suite, Lint & Build Verification**:
  - Verified `npm run lint` inside `frontend/` (0 errors, 0 warnings).
  - Verified `npm test` inside `frontend/` (100% tests passing across all test suites).
  - Verified `npm run build` using Turbopack across all 18 routes with clean compilation.

---

## [1.11.0] - 2026-10-04 — Stage 10: Environmental, Astronomical & Lifestyle Intelligence

### Added & Enhanced
- **Air Quality & Environmental Health Service (`frontend/src/lib/airQualityService.ts` & `/air-quality` Page)**:
  - Created `airQualityService.ts` querying Open-Meteo Air Quality REST endpoint (`https://air-quality-api.open-meteo.com/v1/air-quality`).
  - Extracted and normalized US AQI (0–500), European AQI (0–100+), particulate matter (PM2.5, PM10), and trace pollutants (CO, NO₂, SO₂, O₃) in standard `µg/m³` concentration units.
  - Implemented EPA 5-tier classification (`Good`, `Moderate`, `Sensitive`, `Unhealthy`, `Hazardous`) with actionable general public, sensitive group, and outdoor recreation health advisories.
  - Built live `/air-quality` route (`frontend/src/app/air-quality/page.tsx`) featuring dominant pollutant banner, interactive US AQI gauge, EPA health advisories, and 6-pollutant continuous monitoring grid.
  - Implemented 5-minute memory TTL cache with in-flight request deduplication (`inFlightAirQuality`).
- **Sun & Moon Astronomy Ephemeris Service (`frontend/src/lib/astronomyService.ts` & `/astronomy` Page)**:
  - Created `astronomyService.ts` querying Open-Meteo Forecast daily ephemeris (`sunrise`, `sunset`, `daylight_duration`).
  - Computed client-synchronized solar arc progress percentage (`Pre-Dawn`, `Daylight`, `Post-Dusk`), solar noon zenith, and morning/evening photography Golden Hours.
  - Implemented synodic month lunar cycle mathematics (`29.53058867` days period relative to epoch Jan 6, 2000, 18:14 UTC).
  - Calculated exact Moon illumination percentage (`0–100%`) and 8 distinct Moon phases (`New Moon`, `Waxing Crescent`, `First Quarter`, `Waxing Gibbous`, `Full Moon`, `Waning Gibbous`, `Last Quarter`, `Waning Crescent`).
  - Built live `/astronomy` route (`frontend/src/app/astronomy/page.tsx`) featuring interactive solar arc progress bar, golden hour countdowns, and lunar phase visual card.
  - Implemented 15-minute memory TTL cache with in-flight deduplication (`inFlightAstronomy`).
- **Weather Activity Suitability Engine (`frontend/src/lib/activityService.ts` & `/activities` Page)**:
  - Created `activityService.ts` evaluating 5 outdoor activities (Running & Jogging, Cycling, Hiking & Walking, Beach & Swimming, Stargazing) with multi-variable comfort scoring (0–100).
  - Derived ratings against local temperature, precipitation intensity, wind gusts, cloud cover, relative humidity, and solar daylight status.
  - Standardized rating tiers: `Poor` (<40), `Fair` (40–59), `Good` (60–79), and `Ideal` (80–100) with itemized positive and negative driver explanations.
  - Added daylight lock guardrail for stargazing (score forced to 0 during daylight).
  - Built live `/activities` route (`frontend/src/app/activities/page.tsx`) with Top Pick Hero card, microclimate parameters strip, and category filters (All, Recommended, Daytime, Night).
  - Implemented 5-minute memory TTL cache with in-flight deduplication and pure evaluation mode (`customMetrics`).
- **Testing & Quality Assurance**:
  - Created automated test suite `frontend/src/tests/environmentActivities.test.ts` (4/4 test phases passed).
  - Registered `test:env` script in `frontend/package.json` and integrated into standard `npm test`.

---

## [1.10.0] - 2026-10-04 — Stage 9: Geohazards Architecture (Earthquakes, Volcanoes & Tsunamis)

### Added & Enhanced
- **USGS Live Earthquakes Service (`frontend/src/lib/earthquakeService.ts` & `/earthquakes` Page)**:
  - Created `earthquakeService.ts` integrating USGS GeoJSON real-time seismic feed (`2.5_day.geojson` with fallback to `all_day.geojson`).
  - Implemented Haversine distance & cardinal bearing calculations relative to user `activeLocation`.
  - Color-graded magnitude severity badges (`minor`, `moderate`, `strong`, `major`) and depth indicators.
  - Magnitude filters (M2.5+, M4.5+, M6.0+) and proximity scope filters (Local <500km, Regional <1500km, Global).
  - 5-minute memory cache & in-flight request deduplication.
  - Built live `/earthquakes` page (`frontend/src/app/earthquakes/page.tsx`) with nearest quake card, magnitude badges, and seismic feed.
- **Smithsonian GVP / USGS Volcanoes Service (`frontend/src/lib/volcanoService.ts` & `/volcanoes` Page)**:
  - Created `volcanoService.ts` ingesting Smithsonian GVP & USGS Volcanic Hazards reports.
  - Normalized Aviation Color Codes (`GREEN`, `YELLOW`, `ORANGE`, `RED`) and active eruption vs. unrest activity distinction.
  - Calculated distance and bearing to active user location with 15-minute memory caching.
  - Built live `/volcanoes` page (`frontend/src/app/volcanoes/page.tsx`) with active eruption feed, aviation badges, and status metrics.
- **NOAA / PTWC Tsunamis Service (`frontend/src/lib/tsunamiService.ts` & `/tsunamis` Page)**:
  - Created `tsunamiService.ts` ingesting live NOAA / PTWC bulletin feeds (`tsunami.gov`).
  - Parsed official status levels (`WARNING`, `ADVISORY`, `WATCH`, `INFORMATION`, `NO_ACTIVE`).
  - Built emergency safety guidelines engine and affected ocean basins display.
  - Created live `/tsunamis` page (`frontend/src/app/tsunamis/page.tsx`) and added `Tsunamis` link to main navigation.
- **Leaflet Geohazards Map Overlay Layers (`WeatherMapInternal.tsx` & `WeatherMap.tsx`)**:
  - Added toggleable top-left map controls buttons `🌋 Earthquakes` and `🌋 Volcanoes`.
  - Concentric circle SVG markers scaled to magnitude for quakes; emoji DivIcon markers with Aviation Color Code border rings for volcanoes.
  - Dedicated Leaflet `LayerGroup` instances executing clean `clearLayers()` teardown on toggle off or unmount without touching existing layers.
- **Testing & Quality Assurance**:
  - Created automated test suite `frontend/src/tests/geohazards.test.ts` (6/6 tests passed).
  - Registered `test:geohazards` in `package.json`.

---

## [1.9.0] - 2026-10-01 — Stage 8: Severe Weather Alerts, Thunderstorm Tracking & Service Resilience

### Added & Enhanced
- **Service Timeout Resilience & Single-Retry Fallback (`frontend/src/lib/rainViewerService.ts` & `backend/template.yaml`)**:
  - Increased `RAINVIEWER_DEFAULT_TIMEOUT_MS` from 5,000ms to 10,000ms (10 seconds) to handle mobile and high-latency radar fetch requests.
  - Implemented automatic 1-retry fallback on network drop before failing back to cached or empty radar timelines.
  - Increased AWS SAM `WeatherFunction` execution timeout from 10s to 25s to absorb cold starts and multi-hop external API latency.
- **Severe Weather Warnings & Alerts (`frontend/src/lib/alertsService.ts` & `/alerts` Page)**:
  - Created `alertsService.ts` fetching active meteorological advisories using US NWS GeoJSON endpoint for US locations, and synoptic severe threshold heuristics via Open-Meteo for international/global locations.
  - Standardized alerts into normalized 4-tier model: `Extreme`, `Severe`, `Moderate`, `Minor` with urgency, instructions, and validity intervals.
  - Built live `/alerts` route (`frontend/src/app/alerts/page.tsx`) with color-coded advisory cards (Red for Extreme/Severe, Amber for Moderate, Green for No Active Advisories) and expandable civilian action drawers.
  - Implemented 5-minute memory cache with in-flight deduplication and stale-while-revalidate fallback.
- **Thunderstorm & Convective Tracking (`frontend/src/lib/stormService.ts` & `/storms` Page)**:
  - Created `stormService.ts` evaluating WMO convective codes (95, 96, 99 thunderstorms; squalls, heavy showers) and convective gusts.
  - Calculated multi-factor lightning potential score (0–100) and risk level (`None`, `Moderate`, `High`, `Severe`).
  - Added synthetic regional convective cell cluster model (bearing, distance, hazard rating, and motion vector) within 15–50km.
  - Built live `/storms` route (`frontend/src/app/storms/page.tsx`) with convective index gauge, metric breakdown, and thunderstorm safety protocols.
- **Leaflet Map Lightning & Storm Visualization Layer (`WeatherMapInternal.tsx` & `WeatherMap.tsx`)**:
  - Added toggleable `⚡ Storms` layer to the persistent top-left layer switcher bar.
  - Rendered animated flashing `L.divIcon` markers over coordinates experiencing active convective conditions.
  - Interactive Leaflet popup with storm classification, lightning score, wind gusts, and precipitation risk.
  - Point Metric HUD storm indicator badge and complete memory-safe layer/marker cleanup on unmount or toggle off.
- **Testing & Quality Assurance**:
  - Created automated test suite `frontend/src/tests/alertsStorms.test.ts` (7/7 tests passed).
  - Verified 0 ESLint errors/warnings (`npm run lint`), all 14 test suites passing (`npm test`), and clean Next.js production build (`npm run build`).

---

## [1.8.1] - 2026-09-30 — Stage 7.1: Map Polish — Live Cloud Tiles, Regional Wind Vector Grid & Status Card Synchronization

### Added & Enhanced
- **Real Cloud Tile Stream (`frontend/src/lib/rainViewerService.ts` & `WeatherMapInternal.tsx`)**:
  - Wired the "Clouds" layer to mount real cloud formations using NASA GIBS MODIS Terra Cloud Fraction Day (`MODIS_Terra_Cloud_Fraction_Day`) with full alpha transparency.
  - Added `buildSatelliteInfraredTileUrlTemplate` and `getCloudTileConfig` helpers in `rainViewerService.ts`.
  - Added live NASA GIBS indicator to the Cloud Opacity control bar and smooth `setOpacity` without layer recreation.
- **Regional Animated Wind Vector Grid (`frontend/src/lib/windService.ts` & `WeatherMapInternal.tsx`)**:
  - Implemented `generateWindStreamlineSvg` with dual-layer rotation and GPU-accelerated CSS pulse/flow animation matching wind speed.
  - Added a 5x5 regional grid of streamline markers spanning the visible map bounds around `activeLocation`, re-centering dynamically on map pan/zoom (`moveend`).
  - Coexists with the central location badge pin; cleanly unmounts and clears all grid markers when Wind is toggled off.
- **Synchronized Map Status Cards (`frontend/src/components/map/WeatherMap.tsx` & `maps/page.tsx`)**:
  - Created reusable `MapStatusCards` with unified design hierarchy across Base Map, Doppler Radar, Cloud/Satellite Layer, and Geohazards.
  - Lifted layer state (`LayerState`) via `onLayerStateChange` callback so bottom cards reflect active status dynamically:
    - Doppler Radar card glows sky-blue when Doppler stream is playing.
    - Cloud/Satellite card glows sky-blue when Cloud or Satellite layers are toggled on.
    - Idle cards display clean neutral borders (`border-slate-200 bg-white/70`).
- **Testing & Verification**:
  - Expanded `frontend/src/tests/windSatelliteLayers.test.ts` to 8/8 tests.
  - Verified 0 ESLint errors/warnings (`npm run lint`), all 13 test suites passing (`npm test`), and clean production build (`npm run build`).

---

## [1.8.0] - 2026-09-30 — Stage 7: Wind Patterns, Cloud Cover & Satellite Imagery Layers

### Added & Enhanced
- **Wind Speed, Direction & Vector Layer (`frontend/src/lib/windService.ts` & `WeatherMapInternal.tsx`)**:
  - Created `windService.ts` for extracting wind speed (km/h & mph), gusts, and 360° direction angle.
  - Implemented 16-point cardinal compass conversion (`degreesToCardinal`), Beaufort Scale classification (0–12), and unit conversions (`kmhToMph`, `kmhToKnots`).
  - Added dynamic SVG wind direction vector marker rendered directly on the active location on Leaflet map.
  - Integrated Wind HUD metrics (direction, velocity, peak gusts, Beaufort scale description) into map point metric badge.
- **Cloud Cover Layer & Metric HUD Expansion (`WeatherMapInternal.tsx`)**:
  - Expanded Cloud Metric HUD displaying cloud cover percentage, semantic cloud category (`Clear`, `Partly Cloudy`, `Mostly Cloudy`, `Overcast`), and estimated cloud base altitude.
  - Added toggleable Cloud Cover visualization overlay with opacity control slider.
- **Satellite Imagery Layer (`frontend/src/lib/satelliteService.ts` & `WeatherMapInternal.tsx`)**:
  - Created `satelliteService.ts` supporting keyless, free, open satellite tile providers: **Esri World Imagery** and **NASA GIBS Terra TrueColor**.
  - Configured provider selector, opacity slider (20% to 100%), and proper map attribution strings.
- **Unified Map Layer Switcher Bar (`WeatherMapInternal.tsx`)**:
  - Created top-left layer selection control bar allowing users to toggle and combine layers: Base Map (OpenStreetMap), Doppler Radar (RainViewer), Wind HUD & Vectors, Cloud Overlay, and Satellite Imagery.
  - Co-exists gracefully with the RainViewer timeline playback dock and Leaflet zoom controls.
- **Testing & Quality Assurance**:
  - Created automated test suite `frontend/src/tests/windSatelliteLayers.test.ts` (7/7 tests passed).
  - Verified 0 ESLint errors/warnings (`npm run lint`), all 13 test suites passing (`npm test`), and clean Next.js production build (`npm run build`).

---

## [1.7.0] - 2026-09-30 — Stage 5 & 6: Interactive RainViewer Radar & Open-Meteo Precipitation Nowcast

### Added & Enhanced
- **Interactive RainViewer Doppler Radar Playback (`frontend/src/lib/rainViewerService.ts` & `WeatherMapInternal.tsx`)**:
  - Implemented multi-frame radar timeline parsing in `rainViewerService.ts`, capturing all available past frames (`radar.past`) and future nowcast frames (`radar.nowcast`) from RainViewer API v2.
  - Added interactive radar playback dock to the Leaflet map:
    - **Play / Pause** animation loop toggling with 850ms interval cadence.
    - **Step Backward (⏮️) / Step Forward (⏭️)** buttons and range scrubber for granular 10-minute interval navigation.
    - **Frame Timestamps & Badges**: Displays formatted local observation time, UTC timestamp, frame counter (`Frame X/Y`), and status indicator (`Past Radar` vs `Nowcast`).
    - **Opacity Slider & Visibility Toggle**: Granular radar layer opacity control (10% to 100%) and instant show/hide layer toggle with zero timeline state loss.
    - **Memory-Safe Layer Management**: Fast URL swapping via `tileLayer.setUrl()` to prevent tile layer thrashing, with complete layer and timer teardown on unmount or radar deactivation.
- **Open-Meteo 15-Minute Precipitation Nowcast (`/nowcast` & `weatherService.ts`)**:
  - Built `fetchPrecipitationNowcast` in `weatherService.ts` querying Open-Meteo's `minutely_15=precipitation,precipitation_probability,weather_code` for the next 120 minutes (8 steps of 15 min).
  - Implemented meteorological intensity normalization (`classifyRainIntensity`) mapping to standard categories (`dry`, `light`, `moderate`, `heavy`, `violent`).
  - Added in-memory 5-minute caching (`NOWCAST_CACHE_TTL_MS`), in-flight request deduplication, and stale fallback on network failure.
  - Connected `/nowcast` route (`frontend/src/app/nowcast/page.tsx`) with live data:
    - Summary Badges: Nowcast Horizon (Next 120 Mins), Peak Rain Probability (%), Current Intensity (mm/h), and 2h Cumulative Volume (mm).
    - Trajectory Banner: Contextual summary indicating active rain or expected start window.
    - Responsive Bar Chart: Visual projection across 8 intervals with color-coded intensity bars, value tooltips, and probability markers.
    - Detailed 15-Minute Timeline Table: Complete breakdown of precipitation, rates, intensity category, and WMO condition descriptions.
- **Testing & Verification**:
  - Created comprehensive test suite `frontend/src/tests/radarNowcast.test.ts` (8/8 tests passed).
  - Verified `rainViewerService.test.ts` (9/9 tests passed).
  - Updated `package.json` with `test:radar` and integrated into the global `npm test` script.
  - Verified 0 TypeScript errors, 0 ESLint warnings, all 12 test suites passing (85+ assertions), and clean Next.js production build (`next build` across 17 routes).

---

## [1.6.1] - 2026-09-30 — Phase 9.2: Weather Chatbot Bugfix & Markdown Rendering

### Fixed & Improved
- **Guardrail Pre-flight & Routing (`src/lib/weatherAssistant.ts`)**:
  - Eliminated rigid negative-match pre-flight logic that caused false-positive refusals on spelling variations like `"whether"`.
  - Added explicit allowances for greetings (`"hi"`, `"hello"`, `"good morning"`), weather inquiry terms (`"forecast"`, `"temperature"`, `"rain"`, `"umbrella"`), and active location mentions.
  - Reserved pre-flight refusal strictly for blatant non-weather subjects (code requests, algebra, recipes, trivia, politics), letting the Gemini system instruction govern conversational queries naturally.
- **Complete Grounded Fallback Sentences (`src/lib/weatherAssistant.ts`)**:
  - Repaired template strings in `generateGroundedWeatherAdvice` to prevent incomplete or truncated sentences.
  - Enhanced `"Best time for a walk"` with temperature-aware advice (morning/evening windows for heat, midday solar warming for chilly conditions, and rain alerts).
  - Ensured every fallback branch outputs a complete, grammatically sound sentence with safe temperature fallbacks.
- **Rich Markdown Chat UI (`src/components/WeatherChat.tsx`)**:
  - Integrated `react-markdown` for rendering assistant message content.
  - Supported bold text (`**`), bullet lists, and paragraphs with clean typography and spacing within the chat bubbles.
- **Testing & Verification**:
  - Verified live Next.js `/api/chat` route with `"what is the whether in kolkata?"`, `"Best time for a walk?"`, and `"Write a python function"`.
  - Confirmed 0 TypeScript errors, 0 ESLint warnings, and clean Next.js production build (`next build`).

---

## [1.6.0] - 2026-09-30 — Phase 9: Weather Chatbot with Google Gemini & Prompt Guardrail

### Added & Integrated
- **Google Gemini Provider Integration (`@google/genai`)**:
  - Integrated `gemini-2.5-flash` via the official `@google/genai` SDK in `src/lib/weatherAssistant.ts`.
  - Simple, lightweight architecture: zero vector databases, embeddings, LangChain, or complex agent frameworks.
  - Implemented exact prompt guardrail:
    - `"You are a helpful, concise weather assistant for a weather app. You are provided with the active location's live weather data in JSON format: {weatherContext}..."`
    - Standardized polite refusal for off-topic queries: `'I am your weather assistant and can only help with questions about the current weather, forecasts, and outdoor planning.'`.
  - Built-in grounded deterministic fallback engine when `GEMINI_API_KEY` is missing or placeholder, ensuring the app never crashes.
- **Next.js API Route (`src/app/api/chat/route.ts`)**:
  - Created standard Route Handler (`POST /api/chat`) accepting conversation turns (last 4-6 max) and live `weatherContext`.
  - Validates request payloads and returns typed `{ reply, isOffTopic, source }` JSON responses.
- **Interactive Chat Panel UI (`src/components/WeatherChat.tsx`)**:
  - Embedded into dashboard replacing previous card with an interactive chat panel.
  - Added requested prompt chips: `"Do I need an umbrella today?"`, `"What should I wear?"`, `"Best time for a walk?"`.
  - Input field with Enter-key submission and send button.
  - Scrollable message history with auto-scroll and animated loading indicator.
  - Dynamic injection of active location's live weather state (`locationName`, `temperature`, `feelsLike`, `condition`, `humidity`, `windSpeed`, `precipitation`, `cloudCover`, hourly & daily summaries).
- **Environment & Configuration**:
  - Added `GEMINI_API_KEY=` and `GEMINI_MODEL=gemini-2.5-flash` placeholders to `.env.example`.
  - Confirmed `.env.local` is gitignored.
- **Automated Verification Suite (`src/tests/weatherChatbot.test.ts`)**:
  - 5/5 automated tests validating prompt formatting, on-topic grounded queries, off-topic rejection with exact refusal string, warm weather adaptation, and `/api/chat` Route Handler execution.
  - Passed `npm run lint` with 0 errors and `npm run build` with 0 errors across 17 routes.

---

## [1.5.1] - 2026-09-30 — Phase 8.5.8: Frontend GraphQL Adapter Wiring & Live Backend Integration

### Added & Integrated
- **Environment Configuration**:
  - Configured `frontend/.env.local` with live AppSync HTTPS endpoint (`NEXT_PUBLIC_APPSYNC_GRAPHQL_URL`) and browser token (`NEXT_PUBLIC_APPSYNC_API_KEY`).
  - Updated `frontend/.env.example` with empty placeholder keys for reproducibility.
  - Confirmed `.gitignore` excludes `.env.local` to prevent committing live tokens.
- **Frontend GraphQL Client Module (`src/lib/api/graphqlClient.ts`)**:
  - Implemented lightweight `fetchWeatherByCoordinates(lat, lon, options)` using native Web `fetch` (zero Apollo dependencies).
  - Sends `Content-Type: application/json` and `x-api-key: process.env.NEXT_PUBLIC_APPSYNC_API_KEY`.
  - Dispatches typed `WeatherByCoordinates` query requesting `current` observation, 24-hour `hourly` forecast, and 7-day `daily` projection.
  - Normalizes GraphQL data into client `WeatherReport` model in Celsius.
  - Built-in graceful fallback to direct `weatherService.ts` if cloud endpoint experiences transient network downtime.
- **Dashboard UI Wiring (`src/app/page.tsx`)**:
  - Replaced direct service calls with `fetchWeatherByCoordinates` in active location change lifecycle and refresh handler.
  - Preserved loading skeletons (`isWeatherLoading`), non-destructive refresh indicators (`isRefreshing`), stale fallback notices (`refreshNotice`), and error boundaries.
- **Local Verification & Automated Testing**:
  - Created automated test suite `src/tests/appsyncFrontendClient.test.ts` (5/5 tests passing: live query execution, live refresh query, AbortSignal cancellation, descriptive error throwing, graceful domain fallback).
  - Verified 0 TypeScript errors, 0 ESLint warnings, and clean Next.js production build (`next build`).
  - Verified dev server (`http://localhost:3000`) HTTP 200 OK rendering.

---

## [1.5.0] - 2026-09-30 — Phase 8.5.7: AWS AppSync Cloud Deployment & Live Verification

### Added & Deployed
- **CloudFormation Stack Execution (`weather-gpt-backend`)**:
  - Successfully executed CloudFormation change set `samcli-deploy1790757616` in region `us-east-1`.
  - Stack reached **`CREATE_COMPLETE`** with all cloud resources successfully provisioned.
- **AWS AppSync Managed GraphQL Service**:
  - Deployed `WeatherAppSyncApi` (API ID: `lae4htbgzfbcvjnczbgzio3w6q`) with schema `WeatherAppSyncSchema`.
  - Configured HTTPS GraphQL endpoint: `https://64xz24nnqbdktigtxjwstte234.appsync-api.us-east-1.amazonaws.com/graphql`.
  - Configured authentication modes: Public browser token `API_KEY` (`da2-***`, redacted) and `AWS_IAM`.
- **Serverless Resolver & Background Worker Infrastructure**:
  - Provisioned direct Lambda data source `WeatherLambdaDataSource` invoking `WeatherFunction` (Node.js 20.x, ARM64 architecture).
  - Attached unit resolvers for `Query.weatherByCoordinates` and `Mutation.refreshWeather`.
  - Provisioned `ForecastSyncFunction` with Amazon EventBridge scheduled rule `rate(30 minutes)` for automatic cache warming.
- **End-to-End Live Verification**:
  - Executed live test query against the provisioned AppSync HTTPS endpoint using the provisioned API Key:
    - Queried coordinates: `{ latitude: 22.5726, longitude: 88.3639 }` (Kolkata).
    - Status: **HTTP 200 OK**.
    - Payload verified: Received valid temperature, weather code, wind speed, humidity, timezone (`Asia/Kolkata`), and timestamp with zero GraphQL errors.
    - Verified that resolver successfully invokes `WeatherFunction`, calls upstream Open-Meteo REST API, and returns expected schema-conformant JSON.
- **Documentation & Security**:
  - Synchronized operational status in `docs/AWS.md` and `docs/CHANGELOG.md`.
  - Ensured API key is redacted in committed documentation.

---

## [1.4.0] - 2026-09-29 — Phase 8: Simple Weather & Cloud Map

### Added & Integrated
- **Core Meteorological Data Enrichment (`weatherService.ts`)**:
  - Enriched Open-Meteo REST parameters to fetch `cloud_cover` for current observations and `cloud_cover` for 24-hour hourly forecasts.
  - Extended domain models (`CurrentWeather`, `HourlyForecast`) and GraphQL types with `cloudCover: number` (0–100%).
  - Added deterministic fallback (0%) when upstream provider omits cloud cover data.
- **Keyless RainViewer Doppler Radar Service (`rainViewerService.ts`)**:
  - Integrated RainViewer API v2 (`https://api.rainviewer.com/public/weather-maps.json`) for global precipitation radar overlays requiring zero credentials or API keys.
  - Implemented 5-minute in-memory caching (`RADAR_CACHE_TTL_MS = 300000`) and in-flight request deduplication to prevent redundant network requests.
  - Built graceful fallback returning stale timestamp metadata during transient network interruptions.
  - Clamped radar tile layer `maxNativeZoom: 7` (`L.tileLayer(..., { maxNativeZoom: 7, opacity: 0.65 })`) to avoid HTTP 404 tile errors beyond RainViewer's native radar coverage, while allowing the base map to zoom cleanly up to Leaflet max.
- **Map UI & Doppler Radar Layer Integration (`WeatherMapInternal.tsx`)**:
  - Added interactive Radar ON/OFF control with pulsing status indicator.
  - Built version-tracked tile layer lifecycle (`layerIdRef`) preventing stale or concurrent layer memory leaks during fast toggling or location changes.
  - Implemented floating Cloud Cover HUD displaying real-time cloud percentage and semantic descriptors (`Clear`, `Partly Cloudy`, `Mostly Cloudy`, `Overcast`).
  - Applied corrective UI patch positioning the map top bar (`top-2.5 left-14 right-2.5`) with a 12px horizontal buffer from Leaflet zoom controls, eliminating button overlap in both dashboard cards and `/maps`.
- **Multi-Instance Map Support (`/maps`)**:
  - Hardened full-page weather radar map at `/maps` with coordinate synchronization, radar toggle, and cloud HUD.
- **Comprehensive Automated Verification Suites**:
  - Created `src/tests/rainViewerService.test.ts` (9 tests covering metadata fetching, cache TTL, in-flight deduplication, error handling, stale fallback, tile URL generation, and coordinate bounds).
  - Created `src/tests/mapUiIntegration.test.ts` (9 tests covering radar toggle lifecycle, layer addition/removal, cloud cover HUD formatting, and zoom control coexistence).
  - Expanded automated test baseline to **85 / 85 automated tests passing across 12 test suites**.
  - Verified **0 TypeScript errors**, **0 ESLint errors/warnings**, and successful Next.js production build (`next build` generating 16 routes).

### Milestone Status
- **Phase 8 Execution**: **COMPLETED**.
- **Phase 9 Status (Weather Chatbot)**: NEXT FEATURE MILESTONE (LLM integration, server-side weather grounding, and guardrail enforcement). The existing Weather Assistant UI and GraphQL stub are classified as partially implemented preparation.
- **Deployment Boundaries**: AWS cloud deployment remains deferred / unprovisioned, Docker containerization remains strictly deferred to Phase 10, Cloudflare remains a future deployment target.

---

## [1.3.0] - 2026-09-29 — Phase 7.2: Final Stabilization / Performance & Abort Handling

### Added & Hardened
- **Caller Cancellation Isolation Engine (`weatherService.ts`)**:
  - Decoupled individual caller `AbortSignal`s via `attachAbortSignal()` in `weatherService.ts`.
  - When an individual caller aborts (such as during a React StrictMode unmount, rapid tab switch, or navigation), the underlying wire request to Open-Meteo continues in-flight for concurrent callers without throwing an unhandled `AbortError`.
  - Concurrent callers receive valid data successfully, and the shared memory cache is populated cleanly for instantaneous subsequent retrieval (< 20ms).
- **In-Flight Request Deduplication Resilience**:
  - Safe lifecycle management of the `inFlightRequests` Map registry, ensuring entries are always pruned in a `finally` block upon completion or rejection.
  - Verified rapid sequential location switching (e.g. Kolkata -> London -> Kolkata) ensuring aborted prior promises do not corrupt subsequent active fetches.
- **Loading-State Stabilization & Non-Destructive Refresh**:
  - Enforced strict separation between initial cold load (`!data` showing loading skeletons) and subsequent manual or automatic background refreshes (`isRefreshing` indicator).
  - Completely eliminated skeleton flashing during manual and auto refreshes across `CurrentWeatherCard`, `HourlyForecastList`, and `DailyForecastList`.
- **Stale-While-Revalidate Error Fallback**:
  - If external provider queries fail during non-forced refreshes, the application automatically falls back to cached observation data with `isStale: true` for up to 24 hours (`STALE_FALLBACK_MAX_AGE_MS = 86400000`) rather than destroying rendered UI.
- **Comprehensive Regression Verification Suites**:
  - Created `src/tests/freshnessBugInvestigation.test.ts` (8 automated tests validating refresh timestamp advancement, 10-minute cadence, stale state clearing, manual refresh timer synchronization, visibility change handling, and metadata precision).
  - Created `src/tests/inFlightAbortRegression.test.ts` (3 automated tests validating caller cancellation isolation, post-abort cache population, and rapid sequential location switching).
  - Expanded automated test baseline to **68 / 68 automated tests passing across 10 test suites**.
  - Verified **0 TypeScript errors**, **0 ESLint errors/warnings**, and successful Next.js production build (`next build` generating 16 routes).

### Milestone Status
- **Phase 7.2 Execution**: **COMPLETED**.
- **Phase 8 Status (Simple Weather & Cloud Map)**: Ready for planning and execution (Next Phase — NOT started).
- **Deployment Boundary**: AWS cloud deployment remains deferred / unprovisioned, Docker containerization remains strictly deferred to Phase 10, Cloudflare remains a future deployment target.

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
  - Implemented responsive desktop navigation bar with WeatherGPT branding, categorized dropdown menus (Forecasts, Environment, Geohazards), and direct Radar & Maps link.
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
