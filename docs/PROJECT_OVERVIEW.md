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
- **Weather Assistant Chatbot with Google Gemini (Phase 9)**:
  - **Implemented & Verified**: Integrated into Dashboard with interactive `WeatherChat.tsx` panel featuring quick prompt chips (`"Do I need an umbrella today?"`, `"What should I wear?"`, `"Best time for a walk?"`), Enter-key submission, auto-scrolling message history, and animated typing indicator.
  - **Provider & Model**: Google Gemini (`gemini-2.5-flash`) via the official `@google/genai` SDK with zero complex agent frameworks, vector databases, or LangChain.
  - **Route & Grounding**: Powered by `/api/chat` injecting real-time `weatherContext` JSON (temperature, conditions, humidity, wind, precipitation, and forecasts for active location) directly into the Gemini system prompt.
  - **Strict Guardrails**: Automatically enforces strict weather domain rules; off-topic questions (coding, math, trivia, recipes, history, creative writing) are politely refused with standardized message: `'I am your weather assistant and can only help with questions about the current weather, forecasts, and outdoor planning.'`.
  - **Clean Fallback Engine**: If `GEMINI_API_KEY` is not set or in testing, the assistant operates seamlessly in grounded deterministic meteorological fallback mode without crashing.
- **Supabase Persistence**:
  - `public.locations`: Persists user-selected and recent locations with deterministic 4-decimal coordinate keys.
  - `public.geocoding_cache`: Caches place-name search results for 30 days.
  - Protected with Row Level Security (RLS) policies for `anon` and `authenticated` roles.
- **Internal GraphQL Gateway & AWS AppSync (Phases 6 & 8.5)**:
  - Deployed AWS AppSync managed GraphQL service (`WeatherAppSyncApi`) with Direct Lambda resolver (`WeatherFunction`) in `us-east-1`.
  - Frontend wired via `fetchWeatherByCoordinates` in `src/lib/api/graphqlClient.ts` with direct domain fallback.
- **Verified Quality Baseline**: Full automated test suites passing across all functional domains; 0 TypeScript errors; 0 ESLint errors/warnings; clean Next.js production build across 17 routes.

### Deferred / Target Future Architecture (Phases 10 – 12)
- **Phase 10 (Next Infrastructure Milestone)**: Docker containerization (multi-stage Dockerfile and container verification strictly deferred until Phase 10).
- **Phase 11**: Cloudflare Edge & HTTPS (target deployment architecture for DNS, Full (Strict) SSL, and static CDN).
- **Phase 12**: Testing & Final Verification (release readiness sign-off).
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
| **API Layer** | **GraphQL (AppSync & GraphQL Yoga)** | **Implemented & Deployed** | Managed AWS AppSync production GraphQL endpoint & local `/api/graphql` route with typed SDL schema. |
| **AI Weather Assistant** | **Google Gemini (`gemini-2.5-flash`), Next.js Route (`/api/chat`) & UI Panel** | **Implemented & Verified (Phase 9)** | Weather-grounded chatbot with strict guardrails, prompt chips, and deterministic fallback. |
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
