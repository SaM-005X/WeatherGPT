# Simple Weather Web Application — Troubleshooting Runbook

## 1. Quick Diagnostic Checklist

```text
Issue Encountered
  ├── Geolocation Failure  ──► Check browser HTTPS requirement & location permission (Sec 2.1)
  ├── 502 / CORS on GraphQL ─► Verify API Gateway CORS & Lambda CloudWatch Logs (Sec 2.2)
  ├── Cache / Stale Data   ──► Verify ~5-minute cache logic and external provider response (Sec 2.3)
  ├── Chat Guardrail Alert ──► Verify weather-topic guardrail refusal behavior (Sec 2.4)
  └── Cloudflare 525 Error ──► Check origin certificate and Full (Strict) SSL settings (Sec 2.5)
```

---

## 2. Common Issues & Solutions

### 2.1 Geolocation Blocked in Browser
- **Symptom**: Browser geolocation returns `PERMISSION_DENIED`.
- **Cause**: Browser requires secure HTTPS context (or `localhost`) and user permission.
- **Solution**: Test over `http://localhost:3000` or HTTPS in production. The UI provides a manual location search fallback whenever geolocation is blocked.

### 2.2 GraphQL API Gateway CORS or 502 Error
- **Symptom**: Browser reports CORS error when querying `/graphql`.
- **Cause**: Lambda unhandled error or missing CORS header in API Gateway response.
- **Solution**: Check AWS CloudWatch logs (`aws logs tail /aws/lambda/...`). Ensure Lambda response returns `Access-Control-Allow-Origin: *`.

### 2.3 Stale Weather Data or Cache Misses
- **Symptom**: Weather observations do not update after 5 minutes.
- **Cause**: Database query logic checking `recorded_at >= NOW() - INTERVAL '5 minutes'`.
- **Solution**: Confirm system timestamps match UTC in PostgreSQL. When testing manual refresh, verify the `refreshWeather` mutation bypasses the 5-minute cache.

### 2.4 Weather Chatbot Guardrail Behavior
- **Symptom**: Off-topic questions (e.g., general programming, trivia) are submitted.
- **Expected Behavior**: Chatbot must return a polite refusal:
  > *"I am a dedicated weather assistant. I can only answer questions related to weather conditions, forecasts, and weather-based recommendations."*
- **Solution**: Verify the weather-topic guardrail in the Lambda handler catches non-weather questions before forwarding to the LLM.

### 2.5 Cloudflare Error 525 (SSL Handshake)
- **Symptom**: Cloudflare returns Error 525.
- **Cause**: Origin server certificate missing or invalid when using Full (Strict) SSL.
- **Solution**: Ensure origin host serves a valid certificate or Cloudflare Origin Certificate.
