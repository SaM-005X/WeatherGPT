# WeatherGPT — Supabase PostgreSQL

## 1. Overview

Supabase provides the managed PostgreSQL database for persistent location storage and geocoding query caching.

> **Spatial Simplicity Note**:
> The `postgis` extension may remain enabled in Supabase as it is supported out-of-the-box and may be useful later. However, **the application does not use complex spatial queries (`ST_DWithin`, spatial radius buffers, or geography math)**.
> Location identification and cache queries use simple relational fields: `latitude`, `longitude`, `name`, deterministic coordinate keys, and timestamp fields.

---

## 2. Current Implemented Schema

The active database implementation is defined in `supabase/migrations/20260925000000_create_locations_and_geocoding_cache.sql`.

### 1. Locations Table (`public.locations`)
Persists user-selected and searched geographic locations:

```sql
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country TEXT,
    admin1 TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    timezone TEXT,
    source TEXT NOT NULL DEFAULT 'search',
    coord_key TEXT GENERATED ALWAYS AS (ROUND(latitude::numeric, 4)::text || ',' || ROUND(longitude::numeric, 4)::text) STORED UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_updated_at ON public.locations (updated_at DESC);
```

### 2. Geocoding Cache Table (`public.geocoding_cache`)
Caches geocoding search queries to arrays of normalized results (JSONB) with a 30-day TTL:

```sql
CREATE TABLE IF NOT EXISTS public.geocoding_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL UNIQUE,
    results JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_geocoding_cache_query ON public.geocoding_cache (query);
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_expires_at ON public.geocoding_cache (expires_at);
```

### 3. Exact Row Level Security (RLS) Policies
Row Level Security is enabled on both tables. The exact policies implemented in the migration are:

```sql
-- Enable Row Level Security (RLS)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;

-- Locations RLS Policies
-- Allow anyone (public/anon or authenticated) to read persisted locations
DROP POLICY IF EXISTS "Allow public read on locations" ON public.locations;
CREATE POLICY "Allow public read on locations"
    ON public.locations
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Allow public to insert newly selected locations
DROP POLICY IF EXISTS "Allow public insert on locations" ON public.locations;
CREATE POLICY "Allow public insert on locations"
    ON public.locations
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow public to update updated_at on duplicate conflict upsert
DROP POLICY IF EXISTS "Allow public update on locations" ON public.locations;
CREATE POLICY "Allow public update on locations"
    ON public.locations
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Geocoding Cache RLS Policies
-- Allow public to read cached geocoding results as long as they are not expired
DROP POLICY IF EXISTS "Allow public read on geocoding_cache" ON public.geocoding_cache;
CREATE POLICY "Allow public read on geocoding_cache"
    ON public.geocoding_cache
    FOR SELECT
    TO anon, authenticated
    USING (expires_at > now());

-- Allow public to insert new geocoding search cache entries
DROP POLICY IF EXISTS "Allow public insert on geocoding_cache" ON public.geocoding_cache;
CREATE POLICY "Allow public insert on geocoding_cache"
    ON public.geocoding_cache
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow public to update expired geocoding cache entries
DROP POLICY IF EXISTS "Allow public update on geocoding_cache" ON public.geocoding_cache;
CREATE POLICY "Allow public update on geocoding_cache"
    ON public.geocoding_cache
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
```

> **Security Note**: Public DELETE operations are not defined, meaning deletions are blocked by default under PostgreSQL Row Level Security.

---

## 3. Client Integration & Access Model

- **Frontend Access**: The Next.js frontend connects directly to Supabase via `@supabase/supabase-js` (`src/lib/supabase.ts`) using the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL`.
- **Non-Blocking Fallback**: All persistence calls (`src/lib/locationPersistenceService.ts`) are wrapped in try/catch guards. If Supabase is unreachable or unconfigured, the application gracefully continues operating via direct Open-Meteo API calls.
- **Secret Isolation**: `SUPABASE_SERVICE_ROLE_KEY` is reserved strictly for backend serverless environments and is never exposed to browser bundles.

---

## 4. Deferred / Future Design (Weather Snapshot & Forecast Persistence)

The following tables were designed during Phase 0 as a hypothetical relational weather caching strategy. During Phase 7, their implementation was **formally deferred**:

```sql
-- DEFERRED / FUTURE DESIGN — NOT CURRENTLY IMPLEMENTED IN DATABASE

-- Weather Snapshots (Current Weather Cache)
CREATE TABLE IF NOT EXISTS public.weather_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    temperature DOUBLE PRECISION NOT NULL,
    feels_like DOUBLE PRECISION NOT NULL,
    humidity INT NOT NULL,
    wind_speed DOUBLE PRECISION NOT NULL,
    wind_direction INT NOT NULL,
    weather_code INT NOT NULL,
    condition VARCHAR(50) NOT NULL,
    condition_description VARCHAR(255) NOT NULL,
    uv_index DOUBLE PRECISION,
    pressure DOUBLE PRECISION,
    visibility DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_loc_time 
ON public.weather_snapshots(location_id, recorded_at DESC);

-- Hourly Forecast (Today's Projection)
CREATE TABLE IF NOT EXISTS public.forecast_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    forecast_time TIMESTAMPTZ NOT NULL,
    temperature DOUBLE PRECISION NOT NULL,
    precipitation_probability INT NOT NULL,
    weather_code INT NOT NULL,
    condition VARCHAR(50) NOT NULL,
    wind_speed DOUBLE PRECISION NOT NULL,
    humidity INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forecast_hourly_loc_time 
ON public.forecast_hourly(location_id, forecast_time ASC);

-- Daily Forecast (7-Day Projection)
CREATE TABLE IF NOT EXISTS public.forecast_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    temperature_min DOUBLE PRECISION NOT NULL,
    temperature_max DOUBLE PRECISION NOT NULL,
    precipitation_probability INT NOT NULL,
    precipitation_sum DOUBLE PRECISION,
    weather_code INT NOT NULL,
    condition VARCHAR(50) NOT NULL,
    sunrise TIMESTAMPTZ,
    sunset TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (location_id, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_forecast_daily_loc_date 
ON public.forecast_daily(location_id, forecast_date ASC);
```

### Architectural Rationale for Deferral:
1. **Performance**: The in-memory tiered cache in `weatherService.ts` provides rapid sub-millisecond in-memory cache hits without PostgreSQL network round-trip latency.
2. **Quota Hygiene**: Storing 32 rows (1 current + 24 hourly + 7 daily) per coordinate lookup would rapidly consume database storage quotas.
3. **Provider Efficiency**: Open-Meteo's API is fast (< 200ms) and keyless. Storing persistent weather tables is deferred until multi-region distributed caching (e.g. Redis / ElastiCache) or historical analytics features are required.

---

## 5. Related Documentation

- [Project Overview](PROJECT_OVERVIEW.md) — High-level architecture, module boundaries, and persistent data tiers.
- [System Architecture](ARCHITECTURE.md) — Overall production data flow and client-to-Supabase integration.
- [Deployment Guide](DEPLOYMENT.md) — Production environment variables and Supabase setup steps.
- [Troubleshooting Runbook](TROUBLESHOOTING.md) — Resolving Supabase connectivity and RLS policy issues.
