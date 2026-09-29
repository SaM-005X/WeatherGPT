# WeatherGPT — Project Overview

## 1. Executive Summary

**WeatherGPT** is a clean, focused, full-stack weather application delivering current meteorological conditions, hourly forecasts, 7-day outlooks, an interactive map, and a weather domain assistant.

The platform follows a clean **Decoupled Architecture** featuring a Next.js frontend, an in-memory tiered weather cache, Supabase PostgreSQL for location and geocoding persistence, an internal GraphQL application gateway, and a locally verified AWS Serverless backend foundation.

---

## 2. Implementation Boundaries (Current vs. Deferred)

### Current Verified Implementation (Phases 0 – 8)
- **Location System**: Global `LocationContext` providing single-source-of-truth coordinates (`activeLocation.latitude`, `activeLocation.longitude`), device geolocation, universal text search with geocoding disambiguation, and direct coordinate parsing.
- **Current Weather & Forecasts**: Live meteorological conditions, 24-hour hourly projections, and 7-day daily outlooks via `weatherService.ts` querying the Open-Meteo REST API.
- **Interactive Weather Map & Doppler Radar (Phase 8)**:
  - Standard Leaflet map dynamically centered on active coordinates with marker and GPS accuracy circle (`L.circle`).
  - Keyless RainViewer Doppler radar tile overlay via dedicated `rainViewerService.ts` (5-minute metadata cache, in-flight deduplication, stale fallback, `maxNativeZoom: 7`).
  - User-facing "📡 Radar: ON / OFF" toggle control with version-tracked layer lifecycle management.
  - Floating Cloud Cover HUD displaying real-time cloudiness percentage and condition descriptions.
  - Symmetrical, non-overlapping control layout ensuring full accessibility of Leaflet's native `+` / `−` zoom buttons and the Radar toggle.
  - Multi-instance support across Dashboard (`h-72`) and dedicated `/maps` page (`h-[500px]`).
- **Freshness & Caching Pipeline**:
  - Current weather: 5-minute freshness window.
  - Hourly forecast: 30-minute freshness window.
  - 7-day daily outlook: 2-hour freshness window.
  - Stale fallback retention: Up to 24 hours on network or provider failure (`isStale: true`).
  - In-flight request deduplication and caller cancellation isolation (`AbortController`).
  - Automatic refresh every 10 minutes with tab visibility detection; non-destructive refresh preserving displayed weather.
- **Weather Assistant Preview (Phase 9 Preparation)**:
  - Partially implemented: Functional `WeatherAssistant.tsx` UI on Dashboard with message state, location-aware greeting, input validation, and preview response.
  - GraphQL schema contract (`askWeatherAssistant`), client mutation operation, and resolver stub implemented. (AI backend and guardrails connect in Phase 9).
- **Supabase Persistence**:
  - `public.locations`: Persists user-selected and recent locations with deterministic 4-decimal coordinate keys.
  - `public.geocoding_cache`: Caches place-name search results for 30 days.
  - Protected with Row Level Security (RLS) policies for `anon` and `authenticated` roles.
- **Internal GraphQL Gateway**: `/api/graphql` powered by GraphQL Yoga and typed SDL schema, delegating to domain services. Active dashboard currently uses direct `weatherService.ts`.
- **AWS Serverless Foundation (Local / IaC)**: Dedicated `backend/` service with Lambda handlers (`graphql.ts`, `sync.ts`), API Gateway v2 event transformers, structured CloudWatch logger, and dual IaC templates (`serverless.yml`, `template.yaml`) implemented and verified locally.
- **Verified Quality Baseline**: **85 / 85 automated tests passing across 12 test suites**; 0 TypeScript errors; 0 ESLint errors/warnings; clean Next.js production build.

### Deferred / Target Future Architecture (Phases 9 – 12)
- **Phase 9 (Next Feature Milestone)**: Weather Chatbot (connecting LLM provider via `LLM_API_KEY`, live meteorological context grounding, and server-side weather-only guardrails).
- **Phase 10**: Docker containerization (multi-stage Dockerfile and container verification strictly deferred until Phase 10).
- **Phase 11**: Cloudflare Edge & HTTPS (target deployment architecture for DNS, Full (Strict) SSL, and static CDN).
- **Phase 12**: Testing & Final Verification (release readiness sign-off).
- **AWS Cloud Deployment**: Actual cloud provisioning in an AWS account remains deferred.
- **Persistent Weather Snapshot Tables**: `weather_snapshots`, `forecast_hourly`, and `forecast_daily` tables remain deferred in favor of the high-performance in-memory cache.
- **Placeholder Sub-Routes**: `/earthquakes`, `/volcanoes`, `/activities`, `/alerts`, `/nowcast`, `/storms`, `/air-quality`, and `/astronomy` are presentational UI placeholders; backend services and live data integration remain deferred to future feature expansions.

---

## 3. Technology Stack Summary

| Layer | Primary Technology | Current Implementation Status | Purpose & Role |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **Next.js (App Router, React 19, TypeScript)** | **Implemented & Verified** | Responsive frontend for weather dashboards, location search, and multi-route shell. |
| **Styling** | **Tailwind CSS** | **Implemented & Verified** | Clean, human-designed light weather-app design system. |
| **Mapping & Radar** | **Leaflet + RainViewer API v2** | **Implemented & Verified** | Interactive map centered on active coordinates with GPS accuracy circle and Doppler radar overlay. |
| **Weather Domain Service** | **Open-Meteo REST API via `weatherService.ts`** | **Implemented & Verified** | Upstream meteorological source, cloud cover, WMO mapping, normalization, and tiered cache. |
| **Database & Persistence** | **Supabase PostgreSQL** | **Implemented & Verified** | Persistent `locations` and 30-day `geocoding_cache` tables with Row Level Security. |
| **API Layer** | **GraphQL (GraphQL Yoga)** | **Implemented & Verified Locally** | Internal application gateway at `/api/graphql` with typed SDL schema, domain resolvers, and chat stub. |
| **AI Weather Assistant** | **UI & GraphQL Stub (LLM in Phase 9)** | **Partially Implemented (Phase 9 Target)**| Front-end advisor UI and GraphQL mutation stub; AI backend and guardrails connect in Phase 9. |
| **Backend Runtime** | **Node.js (TypeScript) on AWS Lambda** | **Implemented & Verified Locally** | Serverless Lambda handlers in `backend/` for GraphQL and EventBridge background sync. |
| **AWS Cloud Infrastructure** | **API Gateway v2, EventBridge, CloudWatch, SSM** | **IaC Verified Locally; Cloud Deployment Deferred** | Infrastructure as Code (`serverless.yml`, `template.yaml`) prepared for future deployment. |
| **Containerization** | **Docker** | **Strictly Deferred to Phase 10** | Production containerization created after Phase 9 completion. |
| **Edge / Production Host** | **Cloudflare** | **Future Target Architecture** | DNS management, Full (Strict) SSL/HTTPS termination, and static asset CDN. |

---

## 4. Key Design Decisions

1. **Tiered Freshness & In-Memory Cache**:
   - Current weather (5 min), hourly forecast (30 min), 7-day outlook (2 hours), and emergency stale fallback (24 hours).
   - In-flight request deduplication prevents redundant wire calls when manual, auto, or component refreshes coincide.
2. **Atomic Location Synchronization**:
   - All location attributes (`name`, `country`, `admin1`, `latitude`, `longitude`, `timezone`) update together atomically in `LocationContext`.
3. **Local Development Autonomy**:
   - The application runs 100% locally via `npm run dev` with Next.js and `/api/graphql` without requiring AWS credentials or local cloud emulators.
4. **Deferred Containerization & Cloud Deployment**:
   - Containerization is strictly confined to Phase 10. Actual AWS cloud deployment is intentionally deferred.
5. **Standard Relational Coordinates**:
   - Coordinate grouping uses standard deterministic keys (`ROUND(latitude, 4),ROUND(longitude, 4)`), avoiding complex spatial radius math.
