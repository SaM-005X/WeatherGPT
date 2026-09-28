# Simple Weather Web Application — Deployment Guide

## 1. Simplified Deployment Overview

The application uses a standard, low-maintenance deployment topology:
- **Cloudflare**: DNS management, Full (Strict) SSL/HTTPS termination, and static asset CDN.
- **Frontend Hosting**: Next.js deployed to standard hosting or container runner with Cloudflare proxy.
- **Backend Hosting**: AWS Lambda behind AWS API Gateway (HTTP API v2).
- **Database**: Supabase PostgreSQL.

> **Cloudflare Simplicity Constraint**:
> Cloudflare is kept strictly simple:
> - DNS management
> - HTTPS / Full (Strict) SSL
> - Standard CDN edge caching for static assets
>
> **Do NOT introduce**: Cloudflare Workers, edge databases, complex WAF rules, or custom edge routing.

---

## 2. Cloudflare Configuration

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

| Variable | Environment | Destination | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Production / Local | All | Execution mode (`production` / `development`) |
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | Production / Local | Frontend | URL of GraphQL endpoint |
| `NEXT_PUBLIC_MAP_DEFAULT_LAT` | Production / Local | Frontend | Default latitude if geolocation is denied |
| `NEXT_PUBLIC_MAP_DEFAULT_LON` | Production / Local | Frontend | Default longitude if geolocation is denied |
| `SUPABASE_URL` | Production / Local | AWS Lambda | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Production / Local | AWS Lambda | Privileged backend secret key |
| `LLM_API_KEY` | Production / Local | AWS Lambda | API key for weather chatbot |
| `WEATHER_API_KEY` | Production / Local | AWS Lambda | Optional backup provider API key |

---

## 4. Simplified Deployment Sequence

1. **Supabase**: Run migrations to create tables and indexes.
2. **AWS Lambda**: Deploy serverless backend using `serverless deploy` with secrets configured in AWS SSM.
3. **Frontend**: Build and deploy Next.js frontend with `NEXT_PUBLIC_GRAPHQL_ENDPOINT` pointing to API Gateway.
4. **Cloudflare**: Route domain via Cloudflare with Full (Strict) SSL.
