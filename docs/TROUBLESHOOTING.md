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
  └── [Future / Production Cloud (AWS & Cloudflare)]
        ├── 502 / CORS on GraphQL     ──► Check API Gateway v2 CORS & CloudWatch logs (Sec 3.1)
        ├── EventBridge Sync Errors   ──► Check Lambda sync logs & SSM parameter access (Sec 3.2)
        └── Cloudflare 525 Error      ──► Check origin certificate & Full (Strict) SSL (Sec 3.3)
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
- **Expected Baseline**: **85 / 85 tests passing across 12 test suites**.
- **Individual Test Scripts**:
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

---

## 3. Future / Production Cloud Troubleshooting (AWS & Cloudflare Target)

### 3.1 GraphQL API Gateway CORS or 502 Error
- **Symptom**: Client receives HTTP 502 or CORS error when sending requests to API Gateway.
- **Cause**: Unhandled exception in Lambda handler or missing CORS headers.
- **Solution**:
  - Query CloudWatch Logs using Logs Insights:
    ```sql
    fields @timestamp, message, context.error, context.durationMs
    | filter level = "ERROR"
    | sort @timestamp desc
    | limit 20
    ```
  - Verify `backend/src/utils/apigateway.ts` attaches `Access-Control-Allow-Origin: *` to the response.

### 3.2 EventBridge Forecast Sync Worker Issues
- **Symptom**: Background forecast sync does not warm top locations.
- **Cause**: Lambda timeout, invalid SSM parameter path, or Supabase service role key permissions.
- **Solution**:
  - Inspect CloudWatch Log group `/aws/lambda/weather-gpt-forecast-sync-{stage}`.
  - Verify the Lambda timeout is set to at least 60 seconds in `backend/serverless.yml`.
  - Check that SSM parameters (`/weather-gpt/{stage}/*`) are provisioned.

### 3.3 Cloudflare Error 525 (SSL Handshake Failed)
- **Symptom**: Cloudflare returns Error 525 when proxying requests.
- **Cause**: Origin server certificate missing, expired, or untrusted under Full (Strict) SSL mode.
- **Solution**: Install a valid SSL certificate on the origin host or use Cloudflare Origin CA certificate.
