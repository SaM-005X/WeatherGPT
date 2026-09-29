# WeatherGPT — Deployment Guide

## 1. Target Deployment Overview

> **ARCHITECTURAL BOUNDARY NOTICE**:
> This document specifies the **Target Deployment Architecture** planned for future production releases.
> - Current application status: Fully developed, executed, and verified **locally**.
> - **AWS Cloud Deployment**: Currently **DEFERRED / UNPROVISIONED**.
> - **Docker Containerization**: Strictly deferred to **Phase 10**.
> - **Cloudflare Edge**: Planned for **Phase 11**.

The target production topology consists of:
- **Cloudflare (Phase 11 Target)**: DNS management, Full (Strict) SSL/HTTPS termination, and static asset CDN.
- **Frontend Hosting**: Next.js deployed to standard hosting or container runner with Cloudflare proxy.
- **Backend Hosting (AWS Lambda Target)**: AWS Lambda behind AWS API Gateway (HTTP API v2).
- **Database (Supabase PostgreSQL)**: Managed PostgreSQL hosting `locations` and `geocoding_cache` tables.

> **Cloudflare Simplicity Constraint**:
> Cloudflare is kept strictly simple:
> - DNS management
> - HTTPS / Full (Strict) SSL
> - Standard CDN edge caching for static assets
>
> **Do NOT introduce**: Cloudflare Workers, edge databases, complex WAF rules, or custom edge routing.

---

## 2. Cloudflare Configuration (Target Phase 11)

1. **DNS Management**:
   - Add `A` or `CNAME` records pointing to the frontend host and AWS API Gateway.
   - Enable Cloudflare Proxy (`Proxied: Orange Cloud`).
2. **SSL/TLS Settings**:
   - Mode: **Full (Strict)**.
   - Always Use HTTPS: **Enabled** (redirects HTTP traffic to HTTPS).
3. **Static Caching**:
   - Static assets (`/_next/static/*`) are automatically cached by Cloudflare's global edge network.
   - Dynamic `/graphql` requests pass through directly to AWS API Gateway.

---

## 3. Environment Variables Matrix

| Variable | Environment | Destination | Purpose | Status |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Production / Local | All | Execution mode (`production` / `development`) | Active |
| `NEXT_PUBLIC_SUPABASE_URL` | Production / Local | Frontend | Public Supabase API gateway URL | **Active in Frontend** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production / Local | Frontend | Public safe anon key for RLS-protected queries | **Active in Frontend** |
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | Production / Local | Frontend | URL of GraphQL endpoint (local `/api/graphql` or future API Gateway) | Active |
| `NEXT_PUBLIC_MAP_DEFAULT_LAT` | Production / Local | Frontend | Default latitude if geolocation is denied | Active |
| `NEXT_PUBLIC_MAP_DEFAULT_LON` | Production / Local | Frontend | Default longitude if geolocation is denied | Active |
| `SUPABASE_URL` | Production / Local | AWS Lambda | Supabase project URL for serverless backend | Configured in IaC |
| `SUPABASE_SERVICE_ROLE_KEY` | Production / Local | AWS Lambda | Privileged backend secret key (NEVER in frontend) | Configured in IaC |
| `LLM_API_KEY` | Production / Local | AWS Lambda | API key for weather chatbot (Future Phase 9) | Configured in IaC |
| `WEATHER_API_KEY` | Production / Local | AWS Lambda | Optional backup provider API key | Configured in IaC |

---

## 4. Target Deployment Sequence

1. **Supabase**: Execute migrations (`supabase/migrations/20260925000000_create_locations_and_geocoding_cache.sql`) to set up `locations`, `geocoding_cache`, and RLS policies.
2. **AWS Lambda**: Deploy serverless backend using `serverless deploy` or AWS SAM with secrets configured in AWS SSM Parameter Store (`/weather-gpt/prod/*`).
3. **Frontend**: Build and deploy Next.js frontend with `NEXT_PUBLIC_GRAPHQL_ENDPOINT` pointing to API Gateway (or use self-hosted Next.js).
4. **Cloudflare**: Route custom domain via Cloudflare with Full (Strict) SSL and edge CDN caching.
