# Simple Weather Web Application — Docker Containerization

## 1. Important Phase Execution Notice

> **CRITICAL EXECUTION CONSTRAINT**:
> **Docker must NOT be implemented or used during Phases 1–9.**
> Docker containerization begins **strictly in Phase 10**, only after the application is fully functional and verified locally using standard development tooling (`npm run dev`).
> **Do NOT introduce Kubernetes under any circumstances.**

---

## 2. Phase 10 Containerization Workflow

When Phase 10 is reached:
```
[ Local Application (Functional in Dev) ]
                    │
                    ▼
[ Dockerfile (Multi-stage build) ]
                    │
                    ▼
[ Docker Image (Next.js standalone) ]
                    │
                    ▼
[ Docker Container (Local verification) ]
```

---

## 3. Production Dockerfile Specification (`docker/Dockerfile.frontend`)
*(To be created and built during Phase 10)*

```dockerfile
# Stage 1: Dependency resolution
FROM node:20-alpine AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Stage 2: Application builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./

ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production
RUN npm run build

# Stage 3: Minimal production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Unprivileged user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

---

## 4. Phase 10 Verification Steps

During Phase 10, the container will be verified locally:
```bash
# 1. Build Docker image
docker build -t weather-gpt-frontend:latest -f docker/Dockerfile.frontend .

# 2. Run container locally
docker run -d \
  --name weather-app-test \
  -p 3000:3000 \
  -e NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql \
  weather-gpt-frontend:latest

# 3. Verify health
curl http://localhost:3000
```
