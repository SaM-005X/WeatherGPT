# WeatherGPT

A clean, focused weather web application delivering current meteorological conditions, hourly forecasts, 7-day outlooks, an interactive map, and a weather domain assistant.

Built with **Next.js (App Router, React 19, TypeScript), Tailwind CSS, Leaflet, RainViewer Doppler Radar, AWS AppSync Managed GraphQL, and Supabase PostgreSQL**, backed by an in-memory tiered freshness cache and a production-ready **AWS Serverless backend**.

---

## Architecture Summary

- **Frontend & Navigation**: Next.js 16 App Router with responsive navigation shell, global location search modal, unit toggle (°C / °F), and multi-route architecture (18 application routes).
- **Frontend Packaging & Hosting**: Standalone Next.js multi-stage Docker container (`node:22-alpine`, port 3000) hosted on **Render Web Service** ([https://weathergpt-frontend.onrender.com](https://weathergpt-frontend.onrender.com)).
- **Edge Acceleration & HTTPS**: **Cloudflare** Anycast edge layer ([https://weathergpt.app](https://weathergpt.app)) providing DNS management, Full (Strict) SSL termination, automated HTTP-to-HTTPS redirection, browser-enforced HSTS (`max-age=63072000`), and static CDN asset caching.
- **Global Location System**: Top-level `LocationContext` acting as the single source of truth for coordinates (`activeLocation.latitude`, `activeLocation.longitude`), integrating device GPS, preset locations, direct coordinate parsing, and universal geocoding with disambiguation.
- **External Weather Provider**: Open-Meteo REST API queried via domain service `weatherService.ts`. All meteorological observations and projections are normalized internally in Celsius.
- **Interactive Weather Map & Doppler Radar**: Leaflet map synchronized with `activeLocation`, keyless RainViewer Doppler radar overlay with live playback controls and layer lifecycle management, floating Cloud Cover HUD with real-time percentage and sky conditions, and dedicated `/maps` route.
- **AI Weather Assistant**: Interactive chat UI grounded in real-time meteorological context, powered by **Groq Cloud API** running `qwen/qwen3.8-27b` via Next.js `/api/chat`. Includes strict lifestyle/outdoor activity guardrails and a deterministic grounded meteorological fallback engine when `GROQ_API_KEY` is omitted or rate-limited.
- **In-Memory Freshness & Caching**:
  - Current weather: 5-minute freshness window.
  - Hourly forecast: 30-minute freshness window.
  - 7-day daily outlook: 2-hour freshness window.
  - Emergency fallback: Retains previous observations up to 24 hours on network or provider error (`isStale: true`).
  - Wire deduplication: In-flight request registry prevents duplicate concurrent provider fetches.
  - Caller cancellation isolation: Decoupled `AbortSignal`s allow individual components to abort without cancelling shared fetches or corrupting cache.
  - Non-destructive refresh: 10-minute auto-refresh with tab visibility awareness; previous data remains visible during manual or background updates.
- **Persistent Database (Supabase PostgreSQL)**: Stores user-selected locations (`public.locations`) and caches 30-day geocoding results (`public.geocoding_cache`) with Row Level Security. (Weather persistence snapshot tables remain deferred in favor of high-performance in-memory caching).
- **Managed Production GraphQL Backend (AWS AppSync)**: Deployed AWS AppSync GraphQL API (`lae4htbgzfbcvjnczbgzio3w6q`) in `us-east-1` delegating to direct Lambda resolver `WeatherFunction` with automatic fast-failover (< 2ms) to direct domain services. Background forecast warming is handled by EventBridge-triggered `ForecastSyncFunction` (`rate(30 minutes)`).
- **Local GraphQL Application Gateway**: Internal `/api/graphql` powered by GraphQL Yoga and typed SDL schema for local development and offline testing.

---

## Documentation Index

Comprehensive documentation is maintained in `/docs`:

- **[Project Overview](docs/PROJECT_OVERVIEW.md)**: Scope, architectural boundaries, and directory structure.
- **[Roadmap](docs/ROADMAP.md)**: Phased execution plan (Phases 0 through 12 — all completed).
- **[Architecture](docs/ARCHITECTURE.md)**: System design, Mermaid diagrams, data pipelines, and freshness timing.
- **[GraphQL Specification](docs/GRAPHQL.md)**: Application GraphQL schema, queries, mutations, and AppSync deployment.
- **[AWS Serverless](docs/AWS.md)**: AppSync, Lambda resolvers, EventBridge forecast sync, and CloudWatch observability.
- **[Supabase PostgreSQL](docs/SUPABASE.md)**: Implemented relational schema, exact RLS policies, and deferred designs.
- **[Docker Containerization](docs/DOCKER.md)**: Standalone Next.js multi-stage container and Render hosting runbook.
- **[Cloudflare Edge](docs/CLOUDFLARE.md)**: DNS management, Full (Strict) SSL, edge caching, and security headers.
- **[Deployment Guide](docs/DEPLOYMENT.md)**: Canonical production deployment topology, live endpoints, and environment variables.
- **[Troubleshooting Runbook](docs/TROUBLESHOOTING.md)**: Local development and production cloud diagnostic runbooks.
- **[Changelog](docs/CHANGELOG.md)**: Record of changes, milestone statuses, and releases.

---

## Current Status

- **Phase 0 (Planning & Simplified Architecture)**: **COMPLETED**
- **Phase 1 (Native Frontend Foundation)**: **COMPLETED**
- **Phase 2 (Location System & Leaflet Sync)**: **COMPLETED**
- **Phase 2.1 (Frontend Stabilization & Theme Design System)**: **COMPLETED**
- **Phase 3 (Live Weather Integration via Open-Meteo)**: **COMPLETED**
- **Phase 3.1 (Universal Geocoding & Disambiguation)**: **COMPLETED**
- **Phase 4 (Supabase Persistent Location Data & Cache)**: **COMPLETED**
- **Phase 4.1 (Automatic 10m Refresh & Live Saved Sync)**: **COMPLETED**
- **Step 1 (Navigation Shell & Multi-Route Architecture)**: **COMPLETED**
- **Phase 5 (GraphQL Foundation & Application Gateway)**: **COMPLETED**
- **Phase 6 (AWS Serverless Backend Foundation)**: **COMPLETED**
- **Phase 7 (Weather Updates & Freshness Pipeline)**: **COMPLETED**
- **Phase 7.2 (Final Stabilization / Performance & Abort Handling)**: **COMPLETED**
- **Phase 8 (Simple Weather & Cloud Map)**: **COMPLETED**
- **Phase 8.5 (AWS AppSync Managed GraphQL Integration)**: **COMPLETED & DEPLOYED**
- **Phase 9 (Weather Chatbot with Groq Qwen 3.8 27B & Guardrails)**: **COMPLETED**
- **Phase 10 (Production Docker Containerization — Node 22 Alpine)**: **COMPLETED**
- **Phase 11 (Cloudflare Edge & Production HTTPS Runbook)**: **COMPLETED**
- **Phase 12 (Final Release Gate, Docker Runtime Alignment & Sign-Off)**: **COMPLETED**

**Current Release**: **WeatherGPT v1.14.0** (Production-Ready)

---

## Verified Quality Baseline

- **Automated Tests**: **100% passing across all 18 test suites** (`npm test`)
- **TypeScript**: **0 errors**
- **ESLint**: **0 errors / 0 warnings** (`npm run lint`)
- **Production Build**: **Successful** (`next build` compiling all 18 application routes with zero warnings)
- **Live Endpoint Verification**: AppSync GraphQL API, Render Docker Web Service, Supabase PostgreSQL, and Cloudflare Edge active and operational.
