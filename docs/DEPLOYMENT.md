# WeatherGPT — Deployment Guide

## 1. Target Deployment Overview

> **ARCHITECTURAL BOUNDARY NOTICE**:
> This document specifies the **Target Deployment Architecture** for production releases.
> - Current application status: Fully developed, executed, and verified **locally**.
> - **AWS Cloud Deployment**: Currently **DEFERRED / UNPROVISIONED** (AppSync & SAM templates configured locally).
> - **Docker Containerization**: **COMPLETED & VERIFIED (Phase 10)**.
> - **Cloudflare Edge & Production HTTPS**: **COMPLETED & CONFIGURED (Phase 11)** — See [docs/CLOUDFLARE.md](file:///c:/Users/suman/OneDrive/Desktop/WHETHER_GPT_PROJ/docs/CLOUDFLARE.md).

The target production topology consists of:
- **Cloudflare Edge (Phase 11)**: Global Anycast DNS management, Full (Strict) SSL/HTTPS termination, HSTS security headers, and 1-year immutable edge CDN static caching.
- **Frontend Container Hosting (Phase 10)**: Next.js multi-stage standalone Docker container (`weathergpt-frontend:latest`) deployed to container runners (e.g. AWS App Runner, ECS/Fargate, or Docker host).
- **Backend Hosting (AWS Lambda Target)**: AWS Lambda behind AWS AppSync / API Gateway (HTTP API v2).
- **Database (Supabase PostgreSQL)**: Managed PostgreSQL hosting `locations` and `geocoding_cache` tables with Row Level Security.

> **Cloudflare Simplicity Constraint**:
> Cloudflare is kept strictly simple:
> - DNS management
> - HTTPS / Full (Strict) SSL
> - Standard CDN edge caching for static assets
>
> **Do NOT introduce**: Cloudflare Workers, edge databases, complex WAF rules, or custom edge routing.

---

## 2. Cloudflare Configuration & Edge Architecture (Phase 11)

For the complete production edge operational runbook, origin CA setup, and troubleshooting guide, see **[`docs/CLOUDFLARE.md`](file:///c:/Users/suman/OneDrive/Desktop/WHETHER_GPT_PROJ/docs/CLOUDFLARE.md)**.

1. **DNS & Proxy Management**:
   - `A` record (`@`) pointing to container origin IP with `Proxied: Orange Cloud` enabled.
   - `CNAME` record (`www`) pointing to `@` with `Proxied: Orange Cloud` enabled.
   - Dynamic `/api/graphql` and `/api/chat` requests pass through directly to the backend.
2. **SSL/TLS Settings**:
   - Mode: **Full (Strict)** with Cloudflare Origin CA certificate on origin reverse proxy.
   - Always Use HTTPS: **Enabled** (redirects HTTP traffic to HTTPS).
   - Minimum TLS Version: **TLS 1.2** or **TLS 1.3**.
3. **Edge Security & Cache Headers (configured in `frontend/next.config.ts`)**:
   - `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
   - `X-Content-Type-Options`: `nosniff`
   - `X-Frame-Options`: `SAMEORIGIN`
   - `Referrer-Policy`: `strict-origin-when-cross-origin`
   - `Cache-Control`: `public, max-age=31536000, immutable` on `/_next/static/*` (Cloudflare Edge Cache `HIT`)
   - `Cache-Control`: `no-store, no-cache, must-revalidate` on `/api/*` (Cloudflare Edge Cache `DYNAMIC`)

---

## 3. Environment Variables Matrix

| Variable | Environment | Destination | Purpose | Status |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Production / Local | All | Execution mode (`production` / `development`) | Active |
| `NEXT_PUBLIC_SUPABASE_URL` | Build & Container | Frontend | Public Supabase API gateway URL | **Active in Frontend** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build & Container | Frontend | Public safe anon key for RLS-protected queries | **Active in Frontend** |
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | Build & Container | Frontend | URL of GraphQL endpoint (local `/api/graphql` or future API Gateway) | Active |
| `NEXT_PUBLIC_MAP_DEFAULT_LAT` | Build & Container | Frontend | Default latitude if geolocation is denied | Active |
| `NEXT_PUBLIC_MAP_DEFAULT_LON` | Build & Container | Frontend | Default longitude if geolocation is denied | Active |
| `GROQ_API_KEY` | Container Runtime | Frontend `/api/chat` | API key for LLM Weather Chatbot (Qwen 3.8 27B) | Active |
| `SUPABASE_URL` | Production / Local | AWS Lambda | Supabase project URL for serverless backend | Configured in IaC |
| `SUPABASE_SERVICE_ROLE_KEY` | Production / Local | AWS Lambda | Privileged backend secret key (NEVER in frontend) | Configured in IaC |
| `LLM_API_KEY` | Production / Local | AWS Lambda | API key for weather chatbot (Future Phase 9) | Configured in IaC |
| `WEATHER_API_KEY` | Production / Local | AWS Lambda | Optional backup provider API key | Configured in IaC |

---

## 4. Docker Container Deployment Instructions (Phase 10)

### 4.1 Building the Production Container
Build the standalone image using the multi-stage Dockerfile:
```bash
docker build -t weathergpt-frontend:latest -f frontend/Dockerfile.frontend frontend
```
Build arguments for public client-side variables can be supplied if non-default endpoints are required:
```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" \
  --build-arg NEXT_PUBLIC_GRAPHQL_ENDPOINT="https://your-api.com/graphql" \
  -t weathergpt-frontend:latest \
  -f frontend/Dockerfile.frontend frontend
```

### 4.2 Running the Container in Production
Launch the standalone container with unprivileged runtime security (`nextjs` UID 1001):
```bash
docker run -d \
  --name weathergpt-app \
  --restart unless-stopped \
  -p 3000:3000 \
  -e PORT=3000 \
  -e HOSTNAME="0.0.0.0" \
  -e NODE_ENV=production \
  -e GROQ_API_KEY="your-groq-key" \
  weathergpt-frontend:latest
```

### 4.3 Container Health Verification
Confirm the container is operational and serving all 18 routes and static assets:
```bash
# Verify HTTP 200 on root route
curl -I http://localhost:3000

# Verify static asset chunks
curl -I http://localhost:3000/_next/static/chunks/...

# Check container logs
docker logs weathergpt-app
```

---

## 5. Target Production Deployment Sequence

1. **Supabase**: Execute migrations (`supabase/migrations/20260925000000_create_locations_and_geocoding_cache.sql`) to set up `locations`, `geocoding_cache`, and RLS policies.
2. **AWS Lambda / AppSync**: Deploy serverless backend using AWS SAM (`backend/template.yaml`) with secrets configured in AWS SSM Parameter Store (`/weather-gpt/prod/*`).
3. **Frontend Docker Container**: Build and deploy `weathergpt-frontend:latest` to container host (AWS App Runner, ECS/Fargate, or Docker host) with environment variables configured.
4. **Cloudflare Edge**: Route custom domain via Cloudflare with Full (Strict) SSL, edge CDN caching, and HSTS enforcement per [`docs/CLOUDFLARE.md`](file:///c:/Users/suman/OneDrive/Desktop/WHETHER_GPT_PROJ/docs/CLOUDFLARE.md).
