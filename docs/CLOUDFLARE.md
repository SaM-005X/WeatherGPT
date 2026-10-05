# WeatherGPT — Cloudflare Edge & Production HTTPS Runbook

## 1. Overview & Cloudflare Architectural Boundary (Phase 11)

Phase 11 establishes the global edge layer for WeatherGPT using **Cloudflare** as a high-performance, secure reverse proxy and content delivery network.

> **CRITICAL CLOUDFLARE SIMPLICITY CONSTRAINT**:
> Cloudflare is kept strictly simple, lightweight, and robust:
> - DNS management
> - HTTPS / Full (Strict) SSL termination
> - Edge CDN static asset caching
> - DDoS mitigation and HTTP-to-HTTPS redirect
>
> **STRICT PROHIBITION**: Do **NOT** introduce Cloudflare Workers, edge databases (D1/KV), complex WAF Lua scripts, or custom edge routing. Application routing and business logic live exclusively within the Next.js container on Render and the AWS Lambda backend.

---

## 2. DNS & Proxy Routing Architecture

```
[ Web Browser / Client ]
            │
            ▼ HTTPS (Port 443)
┌────────────────────────────────────────────────────────┐
│ Cloudflare Global Anycast Edge Network (Proxied: Orange)│
│ - Edge SSL Termination (Full Strict)                   │
│ - HTTP to HTTPS 301 Redirect                           │
│ - Static Asset CDN Cache (Native Next.js + Media)      │
│ - DDoS Mitigation & Layer 7 Rate Limiting              │
└────────────────────────────────────────────────────────┘
            │
            ├───────────────────────────────────────────┐
            ▼ HTTPS Proxied Origin                      ▼ Direct HTTPS
┌─────────────────────────────────────────┐ ┌─────────────────────────────────────────┐
│ Render Web Service (Port 3000)          │ │ AWS AppSync Managed GraphQL             │
│ - weathergpt-frontend.onrender.com      │ │ - Managed GraphQL API (us-east-1)       │
│ - Standalone Next.js Node 22 Container  │ │ - Thin Lambda Resolver (WeatherFunction)│
│ - 18 Application Dashboards             │ │ - EventBridge Forecast Warming          │
│ - Dynamic Route Handler (/api/chat)     │ │ - Open-Meteo Direct Service Fallback    │
└─────────────────────────────────────────┘ └─────────────────────────────────────────┘
```

### 2.1 DNS Record Specifications
Configure DNS records in Cloudflare Dashboard (`DNS` > `Records`):

| Type | Name | Target / Content | Proxy Status | TTL | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `@` (root) | `weathergpt-frontend.onrender.com` | **Proxied (Orange Cloud)** | Auto | Root apex domain routing to Render origin |
| **CNAME** | `www` | `weathergpt.app` (or `weathergpt-frontend.onrender.com`) | **Proxied (Orange Cloud)** | Auto | Canonical www subdomain |

> **Origin Resolution**:
> WeatherGPT is hosted on **Render Web Service** (`weathergpt-frontend.onrender.com`). Render dynamically manages IP routing and origin TLS certificates. Do not point an `A` record to static origin IPs unless utilizing a dedicated self-hosted server.

### 2.2 Proxy Status Rules
- **Orange Cloud Enabled (`Proxied`)**: Required for `@` and `www` to activate edge caching, automated Cloudflare SSL certificates, anycast routing, and origin IP shielding.
- **AppSync / GraphQL Pass-Through**: Client browser calls to GraphQL query AWS AppSync directly via HTTPS using the safe browser API key, with fallback to direct meteorological services.

---

## 3. SSL/TLS Production Architecture

### 3.1 SSL/TLS Encryption Mode: Full (Strict)
Navigate to **SSL/TLS** > **Overview** in Cloudflare:
- Set mode to **Full (Strict)**.
- **Why Full (Strict)**: Ensures end-to-end encryption between the visitor, Cloudflare edge, and the Render origin. Render automatically provisions and renews trusted certificates (via Let's Encrypt), allowing Cloudflare to cryptographically validate the origin SSL certificate without requiring manual origin certificate rotation.

### 3.2 Origin Certificate Handling
- **Render Web Service (Current Production)**: Render automatically provisions and manages TLS certificates for custom domains. When adding `weathergpt.app` to your Render service, Render verifies domain ownership via DNS and issues a valid certificate.
- **Self-Hosted Origin Alternative (Historical / Reference)**: If self-hosting on EC2/Nginx instead of Render, install a Cloudflare Origin CA certificate on the origin reverse proxy:
  - Certificate: `/etc/ssl/certs/cloudflare_origin.pem`
  - Private Key: `/etc/ssl/private/cloudflare_origin.key`

### 3.3 Security & Encryption Toggles
- **Always Use HTTPS**: **Enabled** (`SSL/TLS` > `Edge Certificates`). Automatically converts all insecure `http://` requests to secure `https://` with a 301 redirect.
- **Automatic HTTPS Rewrites**: **Enabled**. Automatically updates mixed-content resource URLs from `http://` to `https://`.
- **Minimum TLS Version**: Set to **TLS 1.2** (or **TLS 1.3**). Deprecates insecure legacy TLS protocols.
- **Opportunistic Encryption & TLS 1.3**: **Enabled** with 0-RTT support for low connection overhead.
- **HTTP Strict Transport Security (HSTS)**:
  - Configured via Next.js response headers: `max-age=63072000; includeSubDomains; preload` (enforces browser-level HTTPS enforcement for 2 years).

---

## 4. Edge Cache Rules & Cache-Control Strategy

### 4.1 Next.js Edge Headers Implementation
WeatherGPT configures deterministic response headers in `frontend/next.config.ts`:

```typescript
// frontend/next.config.ts
const headersList = [
  // 1. Global security & HSTS headers
  {
    source: "/:path*",
    headers: [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ],
  },
  // 2. Dynamic API protection (prevents edge proxy caching for live telemetry and LLM chatbot)
  {
    source: "/api/:path*",
    headers: [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
      { key: "Pragma", value: "no-cache" },
    ],
  },
];

// 3. Static media assets caching in production
// (Next.js natively manages /_next/static/ chunk caching with immutable headers)
if (isProduction) {
  headersList.push({
    source: "/(favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|woff|woff2))",
    headers: [
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
    ],
  });
}
```

### 4.2 Cloudflare Cache Behavior Matrix

| Content Type | URL Pattern | Edge Cache Policy | Browser Cache Policy | Cloudflare Status |
| :--- | :--- | :--- | :--- | :--- |
| **Next.js Chunks** | `/_next/static/*` | Native Next.js 16 immutable header | 1 Year (`immutable`) | `HIT` |
| **Static Media & Fonts** | `/favicon.ico`, `*.svg`, `*.png` | Injected 1 Year immutable | 1 Year (`immutable`) | `HIT` |
| **App Routes / HTML** | `/`, `/air-quality`, `/alerts`, etc. | Bypass Cache (`s-maxage=0`) | Dynamic revalidation | `DYNAMIC` |
| **API Endpoints** | `/api/chat`, `/api/graphql` | Bypass Cache | `no-store, no-cache` | `DYNAMIC` |

---

## 5. Diagnostics & Troubleshooting Runbook

### 5.1 Verification Commands

#### 1. Verify Edge SSL Termination & HSTS
```bash
curl -I https://weathergpt.app
```
Expected response headers:
```text
HTTP/2 200
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
referrer-policy: strict-origin-when-cross-origin
server: cloudflare
cf-ray: ...
```

#### 2. Verify Static Media Asset Caching (`HIT`)
```bash
curl -I https://weathergpt.app/favicon.ico
```
Expected response headers:
```text
HTTP/2 200
cache-control: public, max-age=31536000, immutable
cf-cache-status: HIT
server: cloudflare
```

#### 3. Verify Dynamic Route Bypass (`DYNAMIC`)
```bash
curl -I https://weathergpt.app/air-quality
```
Expected response headers:
```text
HTTP/2 200
cf-cache-status: DYNAMIC
```

### 5.2 Common Cloudflare Errors & Mitigations

#### Error 525: SSL Handshake Failed
- **Symptom**: Cloudflare cannot establish a TLS connection with the origin host.
- **Root Cause**: Render origin SSL certificate is still provisioning, expired, or domain mismatch.
- **Remedy**:
  1. Verify the custom domain `weathergpt.app` is added and marked **Verified** in Render Dashboard (`Settings` > `Custom Domains`).
  2. Confirm Cloudflare SSL/TLS mode is set to **Full (Strict)**.

#### Error 522 / 520: Origin Unreachable / Web Server Returns Unknown Error
- **Symptom**: Cloudflare times out attempting to reach the Render Web Service origin.
- **Root Cause**: Render service is sleeping (free tier spinning down) or container deployment failed.
- **Remedy**:
  1. Inspect Render deployment logs to ensure the Next.js container compiled and started successfully (`node server.js`).
  2. Confirm the Render service port is bound to `PORT 3000`.

#### Error 521: Web Server Is Down
- **Symptom**: Render origin refused the TCP connection.
- **Remedy**: Check the Render service status in Render Dashboard. Ensure the latest deploy status is healthy.

---

## 6. Edge Architecture Summary

| Feature | Implementation | Benefit |
| :--- | :--- | :--- |
| **Global Anycast DNS** | Cloudflare DNS (`@`, `www`) | Fast edge resolution across Cloudflare global POPs |
| **Full (Strict) SSL** | Cloudflare Edge + Render Managed TLS | End-to-end TLS 1.3 encryption & MITM prevention |
| **Immutable Static Cache** | Native Next.js chunks + static media rules | High edge cache offload for repeat visitors |
| **Zero Stale Data Risk** | `/api/*` and dynamic routes bypass cache | Real-time weather, geohazards, & AI chatbot responsiveness |
| **Security Headers** | HSTS, nosniff, SAMEORIGIN, strict-origin | Browser-enforced defense-in-depth |

---

## 7. Related Documentation

- [Deployment Guide](DEPLOYMENT.md) — Comprehensive production deployment walkthrough.
- [Docker Containerization](DOCKER.md) — Container build specs and runtime parameters.
- [System Architecture](ARCHITECTURE.md) — Production architecture and edge boundaries.
- [Troubleshooting Runbook](TROUBLESHOOTING.md) — End-to-end operational diagnostic procedures.
