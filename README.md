# Simple Weather Web Application

A clean, focused weather web application featuring current conditions, today's/hourly & 7-day forecasts, a simple weather/cloud map, and a weather chatbot with domain guardrails.

Built with **Next.js, TypeScript, Tailwind CSS, Leaflet, GraphQL, AWS Lambda, Supabase PostgreSQL, and Cloudflare**.

---

## Architecture Summary (Simplified)

- **Application API**: GraphQL on AWS Lambda.
- **External Weather Provider**: REST API (e.g. Open-Meteo).
- **Database & Cache**: Supabase PostgreSQL with simple relational fields and deterministic coordinate keys (~5-minute cache for current weather). PostGIS is enabled for future readiness without complex spatial queries.
- **Background Sync**: AWS EventBridge scheduled worker (~30-minute interval) for forecast/history warming and persistence.
- **Weather Chatbot**: Simple weather-topic guardrail using trusted weather data from the backend; polite short refusal for off-topic questions.
- **Containerization**: Multi-stage Dockerfile and Docker container introduced **strictly in Phase 10** after local verification. **No Kubernetes**.
- **Edge / HTTPS**: Cloudflare for DNS, Full (Strict) SSL/HTTPS, and static asset CDN. No edge workers or edge databases.

---

## Documentation Index

Comprehensive documentation is maintained in `/docs`:

- **[Project Overview](docs/PROJECT_OVERVIEW.md)**: Scope, simplified architecture, and directory structure.
- **[Roadmap](docs/ROADMAP.md)**: Phased execution plan (Phases 0 through 12).
- **[Architecture](docs/ARCHITECTURE.md)**: System design, Mermaid diagrams, data pipelines, and freshness timing.
- **[GraphQL Specification](docs/GRAPHQL.md)**: Application GraphQL schema, queries, mutations, and types.
- **[AWS Serverless](docs/AWS.md)**: Lambda, HTTP API Gateway, EventBridge forecast sync, and Secrets Manager.
- **[Supabase PostgreSQL](docs/SUPABASE.md)**: Relational schema, deterministic caching, and table definitions.
- **[Docker Containerization](docs/DOCKER.md)**: Phase 10 containerization plan and verification runbook.
- **[Deployment & Cloudflare](docs/DEPLOYMENT.md)**: Cloudflare DNS, Full (Strict) SSL, environment variables, and deploy steps.
- **[Troubleshooting Runbook](docs/TROUBLESHOOTING.md)**: Diagnostic checklists, CORS fixes, and operational guidance.
- **[Changelog](docs/CHANGELOG.md)**: Record of changes, simplifications, and milestone statuses.

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
- **Phase 6 (AWS Serverless Backend Foundation)**: **COMPLETED (Verified Locally)**
- **Phase 7 (Weather Updates & Freshness Pipeline)**: **COMPLETED (Verified Locally)**
- **Phase 8 (Simple Weather & Cloud Map)**: Pending (Next Phase)
