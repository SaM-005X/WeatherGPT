# WeatherGPT — Project Overview

## 1. Executive Summary

**WeatherGPT** is a clean, focused, full-stack weather application delivering current meteorological conditions, hourly forecasts, 7-day outlooks, an interactive map, and a weather domain assistant.

The platform follows a clean **Decoupled Architecture** featuring a Next.js frontend packaged into a standalone Docker container (`node:22-alpine`), hosted on **Render Web Service**, edge-accelerated by **Cloudflare**, backed by an in-memory tiered weather cache, Supabase PostgreSQL for location and geocoding persistence, and a production **AWS Serverless backend** featuring managed AWS AppSync GraphQL, Lambda resolvers, and EventBridge background sync.

---

## 2. Implementation Boundaries (Current vs. Deferred)

### Current Verified Implementation (Phases 0 – 12 Completed)
- **Location System (Phase 2 & 3.1)**: Global `LocationContext` providing single-source-of-truth coordinates (`activeLocation.latitude`, `activeLocation.longitude`), device geolocation, universal text search with geocoding disambiguation, and direct coordinate parsing.
- **Current Weather & Forecasts (Phase 3 & 7)**: Live meteorological conditions, 24-hour hourly projections, and 7-day daily outlooks via `weatherService.ts` querying the Open-Meteo REST API. All internal values normalized in Celsius.
- **Interactive Weather Map & Doppler Radar (Phase 8 & Stage 5/6)**:
  - Leaflet map dynamically centered on active coordinates with marker and GPS accuracy circle (`L.circle`).
  - Keyless RainViewer Doppler radar tile overlay via `rainViewerService.ts` (5-minute metadata cache, in-flight deduplication, stale fallback, `maxNativeZoom: 7`).
  - Interactive radar timeline animation dock with Play/Pause, timeline scrubber, and opacity controls.
  - Floating Cloud Cover HUD displaying real-time cloudiness percentage and condition descriptions.
  - Multi-instance support across Dashboard (`h-72`) and dedicated `/maps` page (`h-[500px]`).
- **Freshness & Caching Pipeline (Phase 7 & 7.2)**:
  - Current weather: 5-minute freshness window.
  - Hourly forecast: 30-minute freshness window.
  - 7-day daily outlook: 2-hour freshness window.
  - Stale fallback retention: Up to 24 hours on network or provider failure (`isStale: true`).
  - In-flight request deduplication (`inFlightRequests`) and caller cancellation isolation (`AbortController`).
  - Automatic refresh every 10 minutes with tab visibility detection; non-destructive refresh preserving displayed weather.
- **Weather Assistant Chatbot with Groq Cloud (Phase 9)**:
  - **Implemented & Verified**: Integrated into Dashboard with interactive `WeatherChat.tsx` panel featuring quick prompt chips (`"Do I need an umbrella today?"`, `"What should I wear?"`, `"Best time for a walk?"`), Enter-key submission, auto-scrolling message history, and animated typing indicator.
  - **Provider & Model**: Groq Cloud API running `qwen/qwen3.8-27b` via OpenAI-compatible chat completions endpoint (`https://api.groq.com/openai/v1/chat/completions`) with zero complex agent frameworks, vector databases, or LangChain.
  - **Route & Grounding**: Powered by Next.js Route Handler `/api/chat` injecting real-time `weatherContext` JSON (temperature, conditions, humidity, wind, precipitation, and forecasts for active location) directly into the system prompt.
  - **Strict Guardrails**: Automatically enforces strict weather domain rules; off-topic questions (coding, math, trivia, recipes, history, creative writing) are politely refused with a standardized message.
  - **Clean Fallback Engine**: If `GROQ_API_KEY` is not set, placeholder, or rate-limited (HTTP 429), the assistant operates seamlessly in grounded deterministic meteorological fallback mode without crashing.
- **Supabase Persistence (Phase 4 & 4.1)**:
  - `public.locations`: Persists user-selected and recent locations with deterministic 4-decimal coordinate keys.
  - `public.geocoding_cache`: Caches place-name search results for 30 days.
  - Protected with Row Level Security (RLS) policies for `anon` and `authenticated` roles.
- **Managed Production GraphQL Backend (AWS AppSync — Phase 8.5)**:
  - Deployed AWS AppSync managed GraphQL service (`WeatherAppSyncApi`, API ID `lae4htbgzfbcvjnczbgzio3w6q`) in `us-east-1` with direct Lambda resolver (`WeatherFunction`).
  - Background forecast warming handled by EventBridge scheduled Lambda (`ForecastSyncFunction`, `rate(30 minutes)`).
  - Frontend wired via `fetchWeatherByCoordinates` in `src/lib/api/graphqlClient.ts` targeting AppSync with fast-fail direct service fallback (< 2ms).
  - Local `/api/graphql` route powered by GraphQL Yoga for offline development and local test execution.
- **Full Domain Route Expansion (Stages 5–10)**:
  - All 18 application routes (`/`, `/nowcast`, `/alerts`, `/storms`, `/earthquakes`, `/volcanoes`, `/tsunamis`, `/activities`, `/air-quality`, `/astronomy`, `/maps`, etc.) are fully implemented with live domain services and verified sub-millisecond in-memory cache responses.
- **Production Docker Containerization (Phase 10 & 12)**:
  - Multi-stage Next.js standalone container (`frontend/Dockerfile.frontend`) on `node:22-alpine` (port 3000) running under unprivileged user `nextjs` (UID 1001).
  - Deployed as a web service to Render ([https://weathergpt-frontend.onrender.com](https://weathergpt-frontend.onrender.com)).
- **Cloudflare Edge & Production HTTPS (Phase 11)**:
  - Active Cloudflare Anycast edge layer ([https://weathergpt.app](https://weathergpt.app)) providing DNS, Full (Strict) SSL termination, automated HTTP-to-HTTPS redirect, HSTS (`max-age=63072000`), and static CDN asset caching.
- **Verified Quality Baseline (Phase 12)**:
  - 100% automated test pass across all 18 test suites (`npm test`); 0 TypeScript errors; 0 ESLint errors/warnings; clean Turbopack production compilation across all 18 routes.

### Intentionally Deferred Architecture
- **Relational Weather Snapshot Storage**: Persistent database tables for current weather snapshots (`weather_snapshots`) and forecasts (`forecast_hourly`, `forecast_daily`) remain deferred in favor of high-performance in-memory tiered caching (< 1ms latency).
- **Complex Edge & Cloud Infrastructure**: Cloudflare Workers, edge databases (D1/KV), Kubernetes clusters, microservices, and DynamoDB/S3 caching remain intentionally omitted to maintain system simplicity and cost-efficiency.

---

## 3. Technology Stack Summary

| Layer | Primary Technology | Current Implementation Status | Purpose & Role |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16 (App Router, React 19, TypeScript)** | **Implemented & Verified** | Responsive frontend for weather dashboards, location search, and 18-route application shell. |
| **Styling** | **Tailwind CSS** | **Implemented & Verified** | Clean, human-designed light weather-app design system. |
| **Mapping & Radar** | **Leaflet + RainViewer API v2** | **Implemented & Verified** | Interactive map centered on active coordinates with GPS accuracy circle and Doppler radar overlay. |
| **Weather Domain Service**| **Open-Meteo REST API via `weatherService.ts`** | **Implemented & Verified** | Upstream meteorological source, cloud cover, WMO mapping, normalization, and tiered cache. |
| **Database & Persistence**| **Supabase PostgreSQL** | **Implemented & Active** | Persistent `locations` and 30-day `geocoding_cache` tables with Row Level Security. |
| **GraphQL API Layer** | **AWS AppSync & GraphQL Yoga** | **Deployed & Operational** | Managed AWS AppSync production GraphQL endpoint & local `/api/graphql` route with typed SDL schema. |
| **AI Weather Assistant** | **Groq Cloud (`qwen/qwen3.8-27b`), Next.js Route (`/api/chat`)** | **Implemented & Verified (Phase 9)** | Weather-grounded chatbot with lifestyle guardrails, prompt chips, and deterministic fallback. |
| **Backend Runtime** | **Node.js 20.x (ARM64) on AWS Lambda** | **Deployed & Operational** | Serverless Lambda handlers (`WeatherFunction`, `ForecastSyncFunction`) in AWS `us-east-1`. |
| **AWS Cloud Infrastructure**| **AWS AppSync, Lambda, EventBridge, CloudWatch, IAM** | **Deployed via AWS SAM (Phase 8.5.7)** | Production CloudFormation stack `weather-gpt-backend` in `us-east-1`. |
| **Containerization** | **Docker (Next.js Standalone, Node 22 Alpine)** | **Implemented & Verified (Phase 10/12)** | Multi-stage production container (`node:22-alpine`, non-root user, port 3000). |
| **Frontend Hosting** | **Render Web Service** | **Deployed & Operational** | Cloud web service running standalone Docker container (`weathergpt-frontend.onrender.com`). |
| **Edge / CDN Layer** | **Cloudflare Edge** | **Deployed & Operational (Phase 11)** | DNS management, Full (Strict) SSL termination, HSTS, and edge static CDN caching (`weathergpt.app`). |

---

## 4. Key Design Decisions

1. **Tiered Freshness & In-Memory Cache**:
   - Current weather (5 min), hourly forecast (30 min), 7-day outlook (2 hours), and emergency stale fallback (24 hours).
   - In-flight request deduplication prevents redundant wire calls when manual, auto, or component refreshes coincide.
2. **Atomic Location Synchronization**:
   - All location attributes (`name`, `country`, `admin1`, `latitude`, `longitude`, `timezone`) update together atomically in `LocationContext`.
3. **Local Development Autonomy**:
   - The application runs 100% locally via `npm run dev` with Next.js and `/api/graphql` without requiring AWS credentials or local cloud emulators.
4. **Transport Independence & Fast Failover**:
   - Domain services (`weatherService.ts`, `geocodingService.ts`, `locationPersistenceService.ts`) remain the single source of truth for business logic. Lambda handlers act strictly as thin adapters.
   - The frontend GraphQL client automatically fails over to direct domain service in < 2ms if AppSync encounters timeouts or 5xx errors.
5. **Standard Relational Coordinates**:
   - Coordinate grouping uses standard deterministic keys (`ROUND(latitude, 4),ROUND(longitude, 4)`), avoiding complex spatial radius math.
6. **Token-Conscious AI Guardrails**:
   - Chatbot context injection is minimized to compact weather JSON and 3-4 conversation turns, operating smoothly under Groq free-tier rate limits with immediate meteorological fallback.

---

## 5. Related Documentation

- **[Roadmap](ROADMAP.md)**: Phased execution plan through Phase 12 completion.
- **[Architecture](ARCHITECTURE.md)**: End-to-end system architecture, Mermaid diagrams, and data flows.
- **[Deployment Guide](DEPLOYMENT.md)**: Production deployment instructions, live endpoints, and environment variables.
- **[AWS Serverless](AWS.md)**: AWS AppSync, Lambda, EventBridge, and CloudWatch infrastructure details.
- **[Docker Containerization](DOCKER.md)**: Multi-stage Dockerfile and container runtime specification.
- **[Cloudflare Edge](CLOUDFLARE.md)**: Edge proxy, DNS, SSL/TLS, and caching runbook.
