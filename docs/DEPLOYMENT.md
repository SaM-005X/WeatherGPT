# WeatherGPT — Production Deployment Guide

## 1. Production Architecture Overview

This document specifies the **Verified Live Production Deployment Architecture & Operational Runbook** for WeatherGPT v1.14.0.

> **CANONICAL PRODUCTION TOPOLOGY**:
> - **Frontend Container Runtime**: Node 22 LTS / Alpine 3.20 (`node:22-alpine`) standalone Next.js container via `frontend/Dockerfile.frontend`.
> - **Frontend Hosting**: **Render Web Service** (`https://weathergpt-frontend.onrender.com`) running the standalone Next.js container on port 3000.
> - **Edge Network & DNS**: **Cloudflare Anycast Edge** (`https://weathergpt.app`) providing global DNS, Full (Strict) SSL termination, HSTS security headers, and static CDN caching.
> - **Backend GraphQL**: **AWS AppSync** (`https://64xz24nnqbdktigtxjwstte234.appsync-api.us-east-1.amazonaws.com/graphql`) in `us-east-1` (API ID `lae4htbgzfbcvjnczbgzio3w6q`) backed by `WeatherFunction` with automatic direct domain fallback.
> - **Background Warming**: **AWS EventBridge** triggering `ForecastSyncFunction` every 30 minutes (`rate(30 minutes)`).
> - **Database**: **Supabase PostgreSQL** hosting `public.locations` and `public.geocoding_cache` with Row Level Security.
> - **Weather AI Chatbot**: **Groq Cloud API** (`qwen/qwen3.8-27b`) via Next.js Route Handler `/api/chat`.

```
[ USER BROWSER ]
       │ HTTPS (TLS 1.3)
       ▼
[ CLOUDFLARE EDGE ] (weathergpt.app — DNS, Full Strict SSL, HSTS, Static CDN)
       │ Proxied HTTPS
       ▼
[ RENDER WEB SERVICE ] (weathergpt-frontend.onrender.com)
  └── [ Standalone Docker Container: node:22-alpine (PORT 3000) ]
       │                                     │
       ├─► [ Server-Side /api/chat ]         └─► Client-Side Bundles
       │        │ (HTTPS)                              │ (Direct HTTPS)
       │        ▼                                      │
       │   [ Groq Cloud API ]                          ├─► [ AWS AppSync GraphQL ]
       │   (qwen/qwen3.8-27b)                          │        │
       │                                               │        ▼
       └───────────────────────────────────────────────┤   [ Lambda: WeatherFunction ]
                                                       │        │
                                                       │        ▼
                                                       ├─► [ Open-Meteo Weather API ]
                                                       │
                                                       └─► [ Supabase PostgreSQL ]
                                                           (locations & geocoding_cache)
```

---

## 2. Verified Live Deployment Endpoints

| Tier | Service | URL / Endpoint | Status | SSL / Cache Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Edge CDN** | Cloudflare Edge | `https://weathergpt.app` | **Verified Live** | Full (Strict) SSL, HSTS, immutable static assets |
| **Frontend Host** | Render Web Service | `https://weathergpt-frontend.onrender.com` | **Verified Live** | Multi-stage Docker (`node:22-alpine`), port 3000 |
| **GraphQL Gateway** | AWS AppSync | `https://64xz24nnqbdktigtxjwstte234.appsync-api.us-east-1.amazonaws.com/graphql` | **Verified Live** | API Key authenticated, direct Open-Meteo fallback (< 2ms) |
| **Database** | Supabase Postgres | `https://pwhulhaywzdsggmgweyu.supabase.co` | **Active / Verified** | SSL enforced, RLS on `locations` & `geocoding_cache` |
| **AI Inference** | Groq Cloud | `https://api.groq.com/openai/v1` (`qwen/qwen3.8-27b`) | **Active / Verified** | Server-side `/api/chat` route, guardrail grounded |

---

## 3. Environment Variables Matrix

### 3.1 Frontend Build-Time Arguments & Client Variables

Injected during Docker image compilation (`Stage 2: builder`) and baked into client JavaScript:

| Variable | Target | Purpose | Example / Current Value |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend Client | Supabase project REST/Auth endpoint | `https://pwhulhaywzdsggmgweyu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend Client | Safe public anon key for RLS queries | `eyJhbGciOi...` |
| `NEXT_PUBLIC_APPSYNC_GRAPHQL_URL` | Frontend Client | AWS AppSync managed GraphQL endpoint | `https://64xz24nnqbdktigtxjwstte234.appsync-api.us-east-1.amazonaws.com/graphql` |
| `NEXT_PUBLIC_APPSYNC_API_KEY` | Frontend Client | Safe public browser API key for AppSync | `da2-xxxx...` |
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | Frontend Client | Optional fallback GraphQL endpoint | Defaults to `/api/graphql` |
| `NEXT_PUBLIC_MAP_DEFAULT_LAT` | Frontend Client | Default latitude if geolocation is denied | `40.7128` |
| `NEXT_PUBLIC_MAP_DEFAULT_LON` | Frontend Client | Default longitude if geolocation is denied | `-74.0060` |

### 3.2 Frontend Container Runtime Variables (Secrets)

Supplied strictly at container startup (e.g. Render Dashboard Environment Settings):

| Variable | Target | Purpose | Secret? |
| :--- | :--- | :--- | :--- |
| `PORT` | Container Runtime | Port on which the standalone server listens (`3000`) | No |
| `HOSTNAME` | Container Runtime | Interface binding (`0.0.0.0`) | No |
| `NODE_ENV` | Container Runtime | Runtime environment (`production`) | No |
| `NEXT_TELEMETRY_DISABLED` | Container Runtime | Disables telemetry reporting (`1`) | No |
| `GROQ_API_KEY` | Container Runtime (`/api/chat`) | Groq Cloud API key for weather assistant | **YES — Never expose to client** |

### 3.3 Backend AWS SSM Parameters (`/weather-gpt/prod/*`)

Configured in AWS Systems Manager Parameter Store and consumed by Lambda:

| Parameter Name | Target | Purpose | Type |
| :--- | :--- | :--- | :--- |
| `/weather-gpt/prod/SUPABASE_URL` | Lambda | Supabase project URL | `String` |
| `/weather-gpt/prod/SUPABASE_SERVICE_ROLE_KEY` | Lambda | Privileged backend secret key | `SecureString` |
| `/weather-gpt/prod/WEATHER_API_KEY` | Lambda | Optional backup provider API key | `SecureString` |

---

## 4. End-to-End Production Deployment Walkthrough

### Step 1: Database Migration (Supabase)
Execute migrations in the Supabase Dashboard or CLI:
```bash
# Execute SQL migration
supabase db push
# Or run supabase/migrations/20260925000000_create_locations_and_geocoding_cache.sql
```
Verify that `locations` and `geocoding_cache` tables have Row Level Security enabled.

### Step 2: AWS AppSync & Lambda Backend Deployment (SAM)
Deploy the AWS backend stack using the AWS SAM CLI:
```bash
cd backend
sam build
sam deploy --config-env prod
```
Verify the CloudFormation stack `weather-gpt-backend` reaches status `CREATE_COMPLETE` or `UPDATE_COMPLETE` and note the output `GraphQLApiUrl` and `GraphQLApiKey`.

### Step 3: Frontend Container Deployment on Render Web Service
1. Connect the GitHub repository `https://github.com/SaM-005X/WeatherGPT` to Render.
2. Create a new **Web Service** with the following settings:
   - **Environment**: Docker
   - **Region**: Oregon (US West) or Ohio (US East)
   - **Root Directory**: `frontend`
   - **Dockerfile Path**: `Dockerfile.frontend`
   - **Docker Context**: `frontend`
3. Configure **Environment Variables** in Render Dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APPSYNC_GRAPHQL_URL`
   - `NEXT_PUBLIC_APPSYNC_API_KEY`
   - `GROQ_API_KEY` (Secret)
   - `PORT=3000`
4. Deploy the service and verify it is accessible at:
   `https://weathergpt-frontend.onrender.com`

### Step 4: Cloudflare Custom Domain & Edge Setup
Route the custom production domain `weathergpt.app` through Cloudflare:
1. In Cloudflare DNS, configure:
   - `CNAME` `@` -> `weathergpt-frontend.onrender.com` (Proxied: Orange Cloud)
   - `CNAME` `www` -> `weathergpt.app` (Proxied: Orange Cloud)
2. In Cloudflare SSL/TLS:
   - Set encryption mode to **Full (Strict)**.
   - Enable **Always Use HTTPS**.
   - Enable **HSTS** (max-age 63072000, includeSubDomains, preload).
3. For detailed edge operational instructions, see [Cloudflare Edge Guide](CLOUDFLARE.md).

---

## 5. Production Health Verification & Smoke Testing

Run the following checks to confirm production health:

```bash
# 1. Verify Edge Domain HTTP/2 and Security Headers
curl -sI https://weathergpt.app | grep -E "HTTP|server|strict-transport-security|x-frame-options"

# 2. Verify Direct Render Container Origin
curl -sI https://weathergpt-frontend.onrender.com | grep -E "HTTP|rndr-id"

# 3. Verify AppSync Managed GraphQL Health
curl -s -X POST https://64xz24nnqbdktigtxjwstte234.appsync-api.us-east-1.amazonaws.com/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_APPSYNC_API_KEY" \
  -d '{"query":"query { weatherByCoordinates(latitude: 40.7128, longitude: -74.0060) { latitude longitude timezone } }"}'

# 4. Verify AI Chatbot Endpoint Health (Server-Side)
curl -s -X POST https://weathergpt.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the weather?"}' | grep -o "response"
```

---

## 6. Rollback & Operational Update Workflow

### 6.1 Rolling Application Updates
- Pushes to the `main` branch trigger automated builds on Render.
- Render builds the standalone Docker container and replaces running instances with zero-downtime rolling updates.

### 6.2 Instant Frontend Rollback
If a faulty commit causes frontend regressions:
1. In the **Render Dashboard**, navigate to **Deploys**.
2. Identify the last known healthy deployment commit.
3. Click **Rollback to this deploy** to immediately redeploy the previous container artifact without rebuilding.

### 6.3 AppSync / Lambda Backend Rollback
If a backend deployment introduces regressions:
```bash
# Redeploy the previous Git commit using SAM
git checkout <previous-stable-tag-or-commit>
cd backend
sam build
sam deploy --config-env prod
```
Because the Next.js frontend has built-in circuit breaker fallback to direct Open-Meteo services (< 2ms), frontend weather displays will continue functioning even during backend maintenance or transient AWS outages.

---

## 7. Related Documentation

- [Cloudflare Edge](CLOUDFLARE.md) — Edge DNS, Full (Strict) SSL, and CDN caching configuration.
- [Docker Containerization](DOCKER.md) — Multi-stage build process and standalone container runtime details.
- [AWS Infrastructure](AWS.md) — AppSync GraphQL API, Lambda resolvers, and EventBridge warming rules.
- [Supabase Integration](SUPABASE.md) — Database schema, migration, and Row Level Security policies.
- [System Architecture](ARCHITECTURE.md) — Complete end-to-end production architecture specification.
- [Troubleshooting Runbook](TROUBLESHOOTING.md) — Diagnostic procedures for common production and local issues.
