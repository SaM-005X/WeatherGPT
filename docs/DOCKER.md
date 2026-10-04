# WeatherGPT — Docker Containerization

## 1. Containerization Architecture Overview (Phase 10 — Completed)

WeatherGPT utilizes a secure, multi-stage production Docker container designed around Next.js standalone output (`output: 'standalone'`). This architecture produces an ultra-lean runtime container (~65MB compressed Alpine footprint) containing only the exact traced production dependencies and pre-rendered assets required to serve the 18-route application.

> **CRITICAL EXECUTION & ARCHITECTURAL CONSTRAINTS**:
> - Containerization is an **infrastructure milestone** (Phase 10); product features remain strictly separated.
> - **Kubernetes is strictly prohibited**: Deployment targets single-container runtime runners (e.g. AWS ECS/Fargate, App Runner, or self-hosted Docker host).
> - **Host Development Parity**: Host commands (`npm run dev`, `npm test`, `npm run build`) remain 100% operational on developer machines without requiring Docker.

---

## 2. Multi-Stage Build Workflow

```
[ Stage 1: deps ]
├── Base: node:20-alpine + libc6-compat
├── Ingests: package.json, package-lock.json
└── Operation: npm ci (Frozen lockfile, devDependencies included for build tools)
       │
       ▼
[ Stage 2: builder ]
├── Base: node:20-alpine
├── Ingests: Cached node_modules + application source code
├── Build Arguments: NEXT_PUBLIC_* variables injected into static bundles
└── Operation: npm run build (Turbopack standalone compilation)
       │
       ▼ Output Tracing: .next/standalone + .next/static + public
[ Stage 3: runner ]
├── Base: node:20-alpine (Minimal runtime image, zero npm/build tools)
├── Security: Non-root unprivileged system user (nodejs:nextjs UID/GID 1001)
├── Artifacts: Standalone node server + static assets + public directory
└── Entrypoint: ["node", "server.js"] on PORT 3000 (0.0.0.0)
```

---

## 3. Production Dockerfile Specification (`frontend/Dockerfile.frontend`)

```dockerfile
# Stage 1: Dependency resolution
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Application builder
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GRAPHQL_ENDPOINT
ARG NEXT_PUBLIC_MAP_DEFAULT_LAT
ARG NEXT_PUBLIC_MAP_DEFAULT_LON

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_GRAPHQL_ENDPOINT=$NEXT_PUBLIC_GRAPHQL_ENDPOINT
ENV NEXT_PUBLIC_MAP_DEFAULT_LAT=$NEXT_PUBLIC_MAP_DEFAULT_LAT
ENV NEXT_PUBLIC_MAP_DEFAULT_LON=$NEXT_PUBLIC_MAP_DEFAULT_LON

RUN npm run build

# Stage 3: Minimal production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Non-root unprivileged system user & group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

---

## 4. Build Context & Optimization (`frontend/.dockerignore`)

Build context overhead is eliminated by `.dockerignore` filters:
- Excludes `.git`, `.gitignore`, `node_modules`, `.next`, `out`, and `build`.
- Excludes all local environment files (`.env*.local`, `.env.local`).
- Excludes test files (`src/tests`, coverage reports) and agent scratchpads.
- Excludes operating system metadata (`.DS_Store`, `Thumbs.db`) and IDE configurations.

---

## 5. Container Execution & Runtime Commands

### 1. Build Production Image
```bash
docker build -t weathergpt-frontend:latest -f frontend/Dockerfile.frontend frontend
```

### 2. Run Container (Local Port Mapping)
```bash
# Standard mapping to host port 3000
docker run -d \
  --name weathergpt-prod \
  -p 3000:3000 \
  -e NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql \
  weathergpt-frontend:latest

# If port 3000 is occupied by local host dev server (npm run dev), map to 3001:
docker run -d \
  --name weathergpt-prod \
  -p 3001:3000 \
  weathergpt-frontend:latest
```

### 3. Verify Health & Route Availability
```bash
# Root dashboard health check (HTTP 200)
curl -I http://localhost:3000

# Verify static chunk asset delivery (HTTP 200)
curl -I http://localhost:3000/_next/static/chunks/...

# Check container startup logs (0 startup errors, ready in 0ms)
docker logs weathergpt-prod
```

### 4. Stop & Clean Up Container
```bash
docker stop weathergpt-prod
docker rm weathergpt-prod
```

---

## 6. Runtime Configuration & Environment Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Container Runtime | `3000` | Port on which the standalone Node.js server listens |
| `HOSTNAME` | Container Runtime | `0.0.0.0` | Binds to all network interfaces inside container |
| `NODE_ENV` | Container Runtime | `production` | Optimizes React runtime and disables development overhead |
| `NEXT_TELEMETRY_DISABLED` | Build & Runtime | `1` | Prevents telemetry beaconing to Next.js servers |
| `NEXT_PUBLIC_SUPABASE_URL` | Build-time ARG | Injected | Supabase project endpoint (embedded in client JS) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Build-time ARG | Injected | Safe public anon key for Supabase client |
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | Build-time ARG | Injected | Target GraphQL API gateway endpoint |
| `GROQ_API_KEY` | Container Runtime | Optional | Server-side API key for Weather Chatbot LLM route |
