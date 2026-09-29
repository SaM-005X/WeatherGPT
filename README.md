# WeatherGPT

A clean, focused weather web application delivering current meteorological conditions, hourly forecasts, 7-day outlooks, an interactive map, and a weather domain assistant.

Built with **Next.js (App Router, React 19, TypeScript), Tailwind CSS, Leaflet, RainViewer Doppler Radar, GraphQL Yoga, and Supabase PostgreSQL**, backed by an in-memory tiered freshness cache and a locally verified **AWS Serverless backend foundation**.

---

## Architecture Summary

- **Frontend & Navigation**: Next.js 16 App Router with responsive navigation shell, global location search modal, unit toggle (°C / °F), and multi-route architecture.
- **Global Location System**: Top-level `LocationContext` acting as the single source of truth for coordinates (`activeLocation.latitude`, `activeLocation.longitude`), integrating device GPS, preset locations, direct coordinate parsing, and universal geocoding with disambiguation.
- **External Weather Provider**: Open-Meteo REST API queried via domain service `weatherService.ts`. All meteorological observations and projections are normalized internally in Celsius.
- **Interactive Weather Map & Doppler Radar (Phase 8)**: Leaflet map synchronized with `activeLocation`, keyless RainViewer Doppler radar overlay with live toggle and layer lifecycle management, floating Cloud Cover HUD with real-time percentage and sky conditions, and dedicated `/maps` route.
- **AI Weather Assistant (Partially Implemented / Phase 9 Target)**: Dashboard interactive chat UI with location-aware greeting and preview responses; backed by typed GraphQL schema and resolver stub, ready for LLM integration and server-side guardrail enforcement in Phase 9.
- **In-Memory Freshness & Caching**:
  - Current weather: 5-minute freshness window.
  - Hourly forecast: 30-minute freshness window.
  - 7-day daily outlook: 2-hour freshness window.
  - Emergency fallback: Retains previous observations up to 24 hours on network or provider error (`isStale: true`).
  - Wire deduplication: In-flight request registry prevents duplicate concurrent provider fetches.
  - Caller cancellation isolation: Decoupled `AbortSignal`s allow individual components to abort without cancelling shared fetches or corrupting cache.
  - Non-destructive refresh: 10-minute auto-refresh with tab visibility awareness; previous data remains visible during manual or background updates.
- **Persistent Database (Supabase PostgreSQL)**: Stores user-selected locations (`public.locations`) and caches 30-day geocoding results (`public.geocoding_cache`) with Row Level Security. (Weather snapshot tables remain deferred in favor of in-memory caching).
- **Application API Gateway**: Internal `/api/graphql` powered by GraphQL Yoga and typed SDL schema. The active dashboard intentionally operates on direct `weatherService.ts` for maximum stability.
- **AWS Serverless Backend**: Node.js/TypeScript Lambda handlers (`graphql.ts`, `sync.ts`), API Gateway v2 adapter, CloudWatch logger, and dual IaC templates (`serverless.yml`, `template.yaml`) implemented and verified locally. Actual AWS cloud deployment remains deferred / unprovisioned.
- **Containerization**: Strictly deferred to **Phase 10**. No Docker or Kubernetes in current phases.
- **Edge / HTTPS**: Cloudflare for DNS, Full (Strict) SSL, and static CDN is the target deployment architecture for **Phase 11**.

---

## Documentation Index

Comprehensive documentation is maintained in `/docs`:

- **[Project Overview](docs/PROJECT_OVERVIEW.md)**: Scope, architectural boundaries, and directory structure.
- **[Roadmap](docs/ROADMAP.md)**: Phased execution plan (Phases 0 through 12).
- **[Architecture](docs/ARCHITECTURE.md)**: System design, Mermaid diagrams, data pipelines, and freshness timing.
- **[GraphQL Specification](docs/GRAPHQL.md)**: Application GraphQL schema, queries, mutations, and types.
- **[AWS Serverless](docs/AWS.md)**: Lambda, HTTP API Gateway, EventBridge forecast sync, and Secrets Manager.
- **[Supabase PostgreSQL](docs/SUPABASE.md)**: Implemented relational schema, exact RLS policies, and deferred designs.
- **[Docker Containerization](docs/DOCKER.md)**: Phase 10 containerization plan and verification runbook.
- **[Deployment & Cloudflare](docs/DEPLOYMENT.md)**: Target deployment architecture, DNS, Full (Strict) SSL, and environment variables.
- **[Troubleshooting Runbook](docs/TROUBLESHOOTING.md)**: Local development diagnostic checklists and operational guidance.
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
- **Phase 6 (AWS Serverless Backend Foundation)**: **COMPLETED (Implemented & Verified Locally; Cloud Deployment Deferred)**
- **Phase 7 (Weather Updates & Freshness Pipeline)**: **COMPLETED (Implemented & Verified Locally)**
- **Phase 7.2 (Final Stabilization / Performance & Abort Handling)**: **COMPLETED**
- **Phase 8 (Simple Weather & Cloud Map)**: **COMPLETED**
- **Phase 9 (Weather Chatbot)**: **Pending (Next Feature Milestone)**

---

## Verified Quality Baseline

- **Automated Tests**: **85 / 85 passing across 12 test suites** (`npm test`)
- **TypeScript**: **0 errors**
- **ESLint**: **0 errors / 0 warnings** (`npm run lint`)
- **Production Build**: **Successful** (`next build` generating 16 static/dynamic routes)
