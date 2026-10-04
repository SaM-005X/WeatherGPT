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
> **STRICT PROHIBITION**: Do **NOT** introduce Cloudflare Workers, edge databases (D1/KV), complex WAF Lua scripts, or custom edge routing. Application routing and business logic live exclusively within the Next.js container and AWS Lambda backend.

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
│ - Static Asset CDN Cache (/_next/static/*)             │
│ - DDoS & Layer 7 Rate Limiting                         │
└────────────────────────────────────────────────────────┘
            │
            ├───────────────────────────────────────────┐
            ▼ HTTPS Origin Request                      ▼ Direct HTTPS
┌─────────────────────────────────────────┐ ┌─────────────────────────────────────────┐
│ Next.js Production Container (Port 3000)│ │ AWS AppSync / API Gateway               │
│ - Standalone Node.js Runtime            │ │ - Managed GraphQL API                   │
│ - 18 Application Dashboards             │ │ - Thin Lambda Handlers                  │
│ - Dynamic Routes (/api/chat, /api/gql)  │ │ - EventBridge Weather Sync              │
└─────────────────────────────────────────┘ └─────────────────────────────────────────┘
```

### 2.1 DNS Record Specifications
Configure DNS records in Cloudflare Dashboard (`DNS` > `Records`):

| Type | Name | Target / Content | Proxy Status | TTL | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | `@` (root) | `<ORIGIN_HOST_PUBLIC_IP>` | **Proxied (Orange Cloud)** | Auto | Root apex domain routing |
| **CNAME** | `www` | `@` or `<ORIGIN_CNAME>` | **Proxied (Orange Cloud)** | Auto | Canonical www subdomain |
| **CNAME** | `api` (optional) | `appsync-endpoint.amazonaws.com` | DNS Only (Grey Cloud) | Auto | Dedicated AppSync custom domain |

### 2.2 Proxy Status Rules
- **Orange Cloud Enabled (`Proxied`)**: Required for `@` and `www` to activate edge caching, automated SSL certificates, anycast routing, and IP masking.
- **AppSync / GraphQL Pass-Through**: Client browser calls to GraphQL can either:
  1. Pass through Next.js proxy route `/api/graphql` (protected by Next.js `no-store` headers).
  2. Route directly from client browser to AWS AppSync HTTPS endpoint using AppSync API Key or Cognito authorizer.

---

## 3. SSL/TLS Production Architecture

### 3.1 SSL/TLS Encryption Mode: Full (Strict)
Navigate to **SSL/TLS** > **Overview** in Cloudflare:
- Set mode to **Full (Strict)**.
- **Why Full (Strict)**: Ensures end-to-end encryption between the visitor, Cloudflare edge, and the origin server. Unlike flexible or regular full modes, Full (Strict) cryptographically validates the origin SSL certificate, preventing Man-in-the-Middle (MITM) attacks.

### 3.2 Cloudflare Origin CA Certificate Installation
To validate origin authenticity under Full (Strict):
1. Navigate to **SSL/TLS** > **Origin Server** > **Create Certificate**.
2. Key type: **RSA (2048)** or **ECDSA**.
3. Hostnames: `yourdomain.com`, `*.yourdomain.com`.
4. Validity: 15 years (recommended for zero maintenance).
5. Install certificate files on the host reverse proxy (e.g. Nginx, Caddy, or AWS ALB) in front of the Next.js container:
   - Certificate: `/etc/ssl/certs/cloudflare_origin.pem`
   - Private Key: `/etc/ssl/private/cloudflare_origin.key`

### 3.3 Security & Encryption Toggles
- **Always Use HTTPS**: **Enabled** (`SSL/TLS` > `Edge Certificates`). Automatically converts all insecure `http://` requests to secure `https://` with a 301 redirect.
- **Automatic HTTPS Rewrites**: **Enabled**. Automatically updates mixed-content resource URLs from `http://` to `https://`.
- **Minimum TLS Version**: Set to **TLS 1.2** (or **TLS 1.3**). Deprecates insecure TLS 1.0 and 1.1 protocols.
- **Opportunistic Encryption & TLS 1.3**: **Enabled** with 0-RTT support for ultra-low connection latency.
- **HTTP Strict Transport Security (HSTS)**:
  - Enabled via Next.js headers: `max-age=63072000; includeSubDomains; preload` (enforces browser-level HTTPS enforcement for 2 years).

---

## 4. Edge Cache Rules & Cache-Control Strategy

### 4.1 Next.js Edge Headers Implementation
WeatherGPT configures deterministic response headers in `frontend/next.config.ts`:

```typescript
// frontend/next.config.ts
async headers() {
  return [
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
    // 2. Immutable static chunks (Cloudflare Edge Caches 1 Year)
    {
      source: "/_next/static/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    // 3. Static public assets
    {
      source: "/(favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|woff|woff2))",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    // 4. Dynamic API protection (Bypasses edge proxy cache)
    {
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        { key: "Pragma", value: "no-cache" },
      ],
    },
  ];
}
```

### 4.2 Cloudflare Cache Rules Matrix

| Content Type | URL Pattern | Edge Cache TTL | Browser Cache TTL | Cloudflare Header (`cf-cache-status`) |
| :--- | :--- | :--- | :--- | :--- |
| **Next.js Chunks** | `/_next/static/*` | **1 Year** (31536000s) | 1 Year (immutable) | `HIT` |
| **Static Images & Fonts** | `/favicon.ico`, `*.svg` | **1 Year** | 1 Year (immutable) | `HIT` |
| **App Routes / HTML** | `/`, `/air-quality`, `/alerts`, etc. | **Bypass Cache** (`s-maxage=0`) | Dynamic revalidation | `DYNAMIC` |
| **API Endpoints** | `/api/chat`, `/api/graphql` | **Bypass Cache** | `no-store` | `DYNAMIC` |

### 4.3 Cloudflare Page Rule / Cache Rule (Optional Hardening)
In Cloudflare Dashboard (`Caching` > `Cache Rules`):
1. **Rule 1: Static Assets Cache**:
   - Condition: `URI Path starts with "/_next/static/"`
   - Cache Eligibility: **Eligible for cache**
   - Edge TTL: **Respect origin header** (or Override to 1 Year)
2. **Rule 2: Bypass Dynamic APIs**:
   - Condition: `URI Path starts with "/api/"`
   - Cache Eligibility: **Bypass cache**

---

## 5. Diagnostics & Troubleshooting Runbook

### 5.1 Verification Commands

#### 1. Verify Edge SSL Termination & HSTS
```bash
curl -I https://yourdomain.com
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

#### 2. Verify Static Chunk Caching (`HIT`)
```bash
curl -I https://yourdomain.com/_next/static/chunks/main.js
```
Expected response headers:
```text
HTTP/2 200
cache-control: public, max-age=31536000, immutable
cf-cache-status: HIT
age: 1420
server: cloudflare
```

#### 3. Verify Dynamic Route Bypass (`DYNAMIC`)
```bash
curl -I https://yourdomain.com/air-quality
```
Expected response headers:
```text
HTTP/2 200
cf-cache-status: DYNAMIC
```

### 5.2 Common Cloudflare Errors & Mitigations

#### Error 525: SSL Handshake Failed
- **Symptom**: Cloudflare cannot establish a TLS connection with the origin host.
- **Root Cause**: Origin server lacks a valid SSL certificate while Cloudflare is set to Full (Strict).
- **Remedy**:
  1. Verify the Cloudflare Origin CA certificate is installed on the origin reverse proxy.
  2. Confirm origin server is listening on port 443 with TLS 1.2+ enabled.
  3. Ensure the certificate matches the domain name.

#### Error 522 / 520: Origin Unreachable / Web Server Returns Unknown Error
- **Symptom**: Cloudflare times out attempting to reach origin TCP port.
- **Root Cause**: Origin firewall (e.g. AWS Security Group, iptables, ufw) is blocking Cloudflare IPs, or container is stopped.
- **Remedy**:
  1. Confirm the Next.js Docker container is running (`docker ps`).
  2. Verify origin security groups whitelist [Cloudflare IP Ranges](https://www.cloudflare.com/ips/) for ports 80/443.
  3. Ensure reverse proxy upstream forwards traffic to container port 3000 (`proxy_pass http://127.0.0.1:3000`).

#### Error 521: Web Server Is Down
- **Symptom**: Origin refused TCP connection on port 80/443.
- **Remedy**: Inspect origin host service: `docker logs weathergpt` or check reverse proxy service status (`systemctl status nginx`).

---

## 6. Edge Architecture Summary

| Feature | Implementation | Benefit |
| :--- | :--- | :--- |
| **Global Anycast DNS** | Cloudflare DNS (`@`, `www`) | Fast edge resolution (< 15ms globally) |
| **Full (Strict) SSL** | Cloudflare Edge + Origin CA | End-to-end TLS 1.3 encryption & MITM prevention |
| **Static Cache Hit Rate**| `/_next/static/*` (1yr immutable) | 80%+ origin bandwidth offloaded to edge |
| **Zero Stale Data Risk** | `/api/*` and HTML routes bypass cache | Real-time weather, geohazards & AI chatbot responsiveness |
| **Security Headers** | HSTS, nosniff, SAMEORIGIN, strict-origin | Browser-enforced defense-in-depth |
