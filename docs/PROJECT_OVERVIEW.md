# Simple Weather Web Application — Project Overview

## 1. Executive Summary

The **Simple Weather Web Application** is a clean, focused, full-stack weather application delivering current meteorological conditions, today's/hourly forecasts, 7-day forecasts, a simple weather/cloud map, and a simple weather chatbot.

The platform follows a straightforward **Serverless Backend & Cache-Aside Architecture** using AWS Lambda, GraphQL, and Supabase PostgreSQL.

---

## 2. Core Objectives & Scope

### In-Scope (Phase 0 – Phase 12)
- **Location**: Device geolocation with fallback to manual location search (city/coordinates).
- **Current Weather**: Live conditions with ~5-minute cache checking.
- **Forecasts**: Today's/hourly forecast and 7-day daily forecast.
- **Simple Weather Map**: Basic interactive map displaying cloud cover and weather/radar layers.
- **Periodic Weather Updates**: Supabase persistent storage with scheduled background forecast warming via AWS EventBridge (~30-minute intervals).
- **GraphQL Application API**: Clean GraphQL schema serving as the application API layer on AWS Lambda (calling external REST weather provider and Supabase).
- **Weather Chatbot**: Simple weather assistant that answers weather questions using trusted current weather data, with a simple weather-only guardrail that returns a polite refusal for off-topic queries.
- **Containerization (Phase 10)**: Dockerfile and Docker container for the local application after it works correctly locally.
- **Deployment**: Standard Cloudflare setup (DNS, HTTPS / Full (Strict) SSL, and CDN caching).

### Strict Simplicity Constraints (Out-of-Scope)
- **NO Kubernetes**: Strictly single-container Docker or serverless execution; no K8s, Helm, or cluster orchestration.
- **NO Disaster-Management Systems**: No earthquake, tsunami, volcano, or evacuation features.
- **NO Complex Analytics / Simulations**: No lightning tracking networks, atmospheric physics models, or complex wind flow simulations.
- **NO Edge Databases or Cloudflare Workers**: Keep Cloudflare focused strictly on DNS, HTTPS, and basic CDN caching.
- **NO Complex Spatial Radius Pipelines**: Location lookup uses standard relational fields and deterministic coordinate keys rather than complex multi-kilometer spatial algorithms.

---

## 3. Technology Stack Summary

| Layer | Primary Technology | Purpose & Role |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js (App Router, React, TypeScript)** | Modern React frontend for weather dashboards, location search, and chatbot drawer. |
| **Styling** | **Tailwind CSS** | Clean, responsive UI with light/dark theme support. |
| **Mapping** | **Simple map library (Leaflet / react-leaflet)** | Simple interactive map for clouds and precipitation overlays. |
| **API Layer** | **GraphQL (AWS Lambda)** | Application API layer between frontend and backend services. |
| **Backend Runtime** | **Node.js (TypeScript) on AWS Lambda** | Simplest suitable runtime for Lambda + GraphQL; shares TypeScript types with frontend. |
| **Database & Persistence** | **Supabase PostgreSQL** | Stores locations, current weather snapshots, and forecast history. PostGIS enabled for future readiness, but queries remain simple standard SQL. |
| **AWS Serverless** | **Lambda, API Gateway (HTTP API v2), EventBridge, CloudWatch, Secrets Manager** | Serverless execution, ~30-min scheduled forecast warming, and secure secret storage. |
| **External Weather** | **External Weather Provider (REST)** | Upstream meteorological source (e.g. Open-Meteo). GraphQL is our app layer, not required of provider. |
| **Containerization** | **Docker (Introduced only in Phase 10)** | Production containerization created after the app works locally. |
| **Edge / Deployment** | **Cloudflare** | Simple DNS management, Full (Strict) SSL/HTTPS termination, and static asset CDN. |

---

## 4. Key Design Decisions

1. **Clear Freshness Model**:
   - **Current Weather**: Checked on-demand when user opens/refreshes the app. Checks a short-lived (~5 minute) cache in Supabase. If stale, fetches from external REST provider and updates Supabase.
   - **Background Forecast Updates**: AWS EventBridge triggers a Lambda worker every ~30 minutes to warm and persist forecast and daily outlook data.
2. **Simple Deterministic Location Caching**:
   - Stored with standard fields (`latitude`, `longitude`, `location_name`, `cached_at`). Avoids complex spatial radius calculations (`ST_DWithin`).
3. **Simple Guardrailed Chatbot**:
   - Straightforward weather guardrail: answers only weather questions using trusted weather data provided by the backend. Refuses off-topic questions with a short polite refusal. No complex intent-classification micro-pipelines.
4. **Deferred Containerization**:
   - Application is built and validated locally first (Phases 1–9). Docker is only introduced in Phase 10.
5. **Simple Cloudflare Integration**:
   - Standard Cloudflare DNS, HTTPS, and CDN. No Workers, edge databases, or complex custom routing.
