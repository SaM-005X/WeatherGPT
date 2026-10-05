# WeatherGPT — Troubleshooting Runbook

## 1. Quick Diagnostic Flow

```text
Issue Encountered
  │
  ├── [Local Development]
  │     ├── Geolocation Blocked       ──► Check localhost / HTTPS requirement & permission (Sec 2.1)
  │     ├── In-Memory Cache & Stale   ──► Check 5m/30m/2h TTLs & getCacheStatus() (Sec 2.2)
  │     ├── Geocoding / Search Issues ──► Check coordinate bounds & geocoding_cache (Sec 2.3)
  │     └── Supabase Offline / Fallback─► Verify anon key & check non-blocking fallback (Sec 2.4)
  │
  ├── [Production Frontend & Edge (Render & Cloudflare)]
  │     ├── Render Deploy / Build Fail──► Check Docker build logs & build-time ARGs (Sec 3.1)
  │     ├── Container Startup / 502   ──► Check PORT=3000 binding & non-root user (Sec 3.2)
  │     ├── Chatbot Unresponsive     ──► Verify runtime GROQ_API_KEY secret in Render (Sec 3.3)
  │     └── Cloudflare 52x Errors     ──► Check Render custom domain verification & TLS (Sec 3.4)
  │
  └── [Production AWS Backend (AppSync & EventBridge)]
        ├── AppSync GraphQL Errors    ──► Check API key validity & direct fallback (Sec 4.1)
        ├── Lambda Resolver Failures  ──► Inspect CloudWatch logs for WeatherFunction (Sec 4.2)
        └── EventBridge Sync Errors   ──► Inspect CloudWatch logs for ForecastSyncFunction (Sec 4.3)
```

---

## 2. Local Development Troubleshooting

### 2.1 Geolocation Blocked in Browser
- **Symptom**: Browser geolocation returns `PERMISSION_DENIED` or fails silently.
- **Cause**: Modern browsers require a secure origin (`http://localhost` or HTTPS) and explicit user permission.
- **Solution**:
  - Test over `http://localhost:3000`.
  - Check browser location permissions for the site.
  - The application provides an immediate manual search input and preset buttons (London, Kolkata, Tokyo, etc.) so testing is never blocked.

### 2.2 Weather Data Freshness & Cache Behavior
- **Symptom**: Weather data appears unchanged or user questions whether an update occurred.
- **Cause**: In-memory tiered freshness policy in `weatherService.ts`:
  - Current conditions: 5-minute TTL (`CURRENT_TTL_MS = 300000`).
  - Hourly forecast: 30-minute TTL (`HOURLY_TTL_MS = 1800000`).
  - Daily forecast: 2-hour TTL (`DAILY_TTL_MS = 7200000`).
  - Stale fallback: Retains previous observation up to 24 hours on network error (`isStale: true`).
- **Solution**:
  - Click the **"↻ Refresh"** button on the Current Weather card to trigger `forceRefresh: true` which bypasses the memory cache.
  - Check `getCacheStatus(lat, lon)` in developer tools or console logs.
  - If external network requests fail, the application deliberately displays the stale cached data with an inline notice rather than clearing the UI.

### 2.3 Geocoding & Coordinate Validation
- **Symptom**: Search returns "Invalid coordinates" or no results.
- **Cause**: Direct coordinate inputs must adhere to geographical bounds: latitude `[-90, 90]`, longitude `[-180, 180]`.
- **Solution**: Verify input format (e.g. `22.5726, 88.3639` or `22.5726 88.3639`). If searching by place name, ensure the query is not empty and check Supabase `geocoding_cache` or Open-Meteo geocoding availability.

### 2.4 Supabase Connection & Graceful Fallback
- **Symptom**: Console logs show `[LocationPersistence] Unable to persist location to Supabase`.
- **Cause**: Supabase project unreachable, network disconnect, or missing environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- **Solution**:
  - Check `.env.local` contains valid Supabase public keys.
  - **Graceful Degradation**: Core weather and geocoding services continue to function completely via direct Open-Meteo REST calls even if Supabase is offline.

### 2.5 Automated Test Verification
- **Run Full Verification**:
  ```bash
  cd frontend
  npm test
  ```
- **Verified Production Baseline**: **119 / 119 tests passing across 18 test suites, 0 failures**.
- **Key Test Scripts**:
  - `npm run test:geo` — Geocoding service tests
  - `npm run test:db` — Supabase integration tests
  - `npm run test:p41` — Auto-refresh and live saved locations tests
  - `npm run test:cleanup` — Navigation shell regression tests
  - `npm run test:gql` — GraphQL schema and resolver tests
  - `npm run test:lambda` — AWS Lambda integration tests
  - `npm run test:freshness` — Weather freshness and deduplication tests
  - `npm run test:freshness-bug` — Freshness bug regression suite
  - `npm run test:perf` — In-flight deduplication and abort isolation tests
  - `npm test -- src/tests/rainViewerService.test.ts` — RainViewer radar service tests
  - `npm test -- src/tests/mapUiIntegration.test.ts` — Map UI integration, controls, and HUD tests
  - `npm test -- src/tests/chatService.test.ts` — Weather chatbot service and lifestyle guardrails

---

## 3. Production Frontend & Edge Troubleshooting (Render & Cloudflare)

### 3.1 Render Build Failures (Docker Build Errors)
- **Symptom**: Deployment fails during `npm run build` on Render.
- **Cause**: Missing build-time public arguments or TypeScript type errors.
- **Solution**:
  - Ensure all required public variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APPSYNC_GRAPHQL_URL`) are configured in Render Dashboard.
  - Review Render build logs to identify any compilation syntax or missing asset issues.

### 3.2 Container Startup Failures & Port Binding Errors
- **Symptom**: Render reports "Service failed to bind to port" or container crashes immediately after starting.
- **Cause**: Application not listening on `0.0.0.0:3000` or file permission errors on `.next/standalone`.
- **Solution**:
  - Verify `frontend/Dockerfile.frontend` sets `ENV PORT=3000` and `ENV HOSTNAME="0.0.0.0"`.
  - Ensure `.next` directory ownership is assigned to unprivileged user `nextjs:nodejs` (UID/GID 1001).
  - Verify health check path is set to `/` (HTTP 200).

### 3.3 Chatbot Unresponsive or Returning Fallback Responses
- **Symptom**: AI Assistant responses indicate fallback advice or "Assistant unavailable".
- **Cause**: Missing or invalid `GROQ_API_KEY` in Render container runtime environment.
- **Solution**:
  - Navigate to Render Dashboard > **Environment** for `weathergpt-frontend`.
  - Verify `GROQ_API_KEY` is present and starts with `gsk_`.
  - Note: Next.js `/api/chat` route will gracefully return grounded deterministic lifestyle recommendations if Groq is unreachable.

### 3.4 Cloudflare 52x Errors with Render Origin
- **Error 525 (SSL Handshake Failed)**:
  - *Cause*: Render origin TLS certificate is still generating or domain verification is pending.
  - *Solution*: Verify `weathergpt.app` is added and marked green in Render Dashboard (`Settings` > `Custom Domains`). Confirm Cloudflare is set to **Full (Strict)**.
- **Error 522 / 520 (Origin Unreachable / Timeout)**:
  - *Cause*: Render Web Service is sleeping or rebuilding.
  - *Solution*: Check Render service status. If on free tier, allow 30–50 seconds for cold boot.
- **Error 521 (Web Server Is Down)**:
  - *Cause*: Container process exited or failed health check.
  - *Solution*: Inspect Render runtime logs for unhandled Node.js exceptions.

---

## 4. Production AWS Backend Troubleshooting (AppSync & Lambda)

### 4.1 AWS AppSync GraphQL Errors
- **Symptom**: Client receives HTTP 401 Unauthorized or network errors when calling AppSync.
- **Cause**: Expired AppSync API key or incorrect endpoint URL.
- **Solution**:
  - Verify `NEXT_PUBLIC_APPSYNC_GRAPHQL_URL` points to the active API:
    `https://64xz24nnqbdktigtxjwstte234.appsync-api.us-east-1.amazonaws.com/graphql`
  - In AWS Console (`AppSync` > `Settings`), check if the API key has expired. If refreshed, update `NEXT_PUBLIC_APPSYNC_API_KEY` in Render and redeploy.
  - **Graceful Fallback**: Next.js client automatically falls back to direct Open-Meteo REST calls (< 2ms) if AppSync returns an error.

### 4.2 Lambda Resolver Failures (`WeatherFunction`)
- **Symptom**: AppSync returns GraphQL errors with `Lambda:Unhandled` or timeout.
- **Cause**: Upstream Open-Meteo network timeout or Lambda execution error.
- **Solution**:
  - Query CloudWatch Logs Insights for `/aws/lambda/weather-gpt-backend-WeatherFunction-*`:
    ```sql
    fields @timestamp, @message
    | filter @message like /ERROR/
    | sort @timestamp desc
    | limit 20
    ```
  - Verify Lambda execution timeout is configured to at least 15 seconds.

### 4.3 EventBridge Forecast Sync Worker Issues (`ForecastSyncFunction`)
- **Symptom**: Scheduled background warming does not update top locations.
- **Cause**: EventBridge schedule rule disabled or Lambda execution error.
- **Solution**:
  - In AWS Console, verify EventBridge rule `ForecastSyncFunctionHalfHourlySchedule` is **ENABLED** (`rate(30 minutes)`).
  - Inspect CloudWatch Log group `/aws/lambda/weather-gpt-backend-ForecastSyncFunction-*`.
  - Check that SSM parameters (`/weather-gpt/prod/*`) are accessible by the Lambda IAM role.

---

## 5. Historical API Gateway v2 Foundation (Phase 6)

> **HISTORICAL REFERENCE**:
> During Phase 6, a standalone HTTP API v2 gateway was configured in `backend/serverless.yml`.
> In Phase 8.5, managed AWS AppSync replaced API Gateway v2 as the primary production GraphQL entry point.
> If maintaining or diagnosing legacy Phase 6 endpoints:
> - Check CORS configuration: verify `Access-Control-Allow-Origin: *` in `backend/src/utils/apigateway.ts`.
> - Check CloudWatch Logs for legacy stack `weather-gpt-backend-prod`.

---

## 6. Related Documentation

- [Deployment Guide](DEPLOYMENT.md) — Production deployment instructions and environment matrix.
- [Cloudflare Edge](CLOUDFLARE.md) — Edge DNS, Full (Strict) SSL, and error mitigation runbook.
- [Docker Containerization](DOCKER.md) — Container build procedures and operational commands.
- [AWS Infrastructure](AWS.md) — AWS AppSync, Lambda functions, and EventBridge architecture.
