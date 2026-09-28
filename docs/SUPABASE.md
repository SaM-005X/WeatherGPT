# Simple Weather Web Application — Supabase PostgreSQL

## 1. Overview

Supabase provides the managed PostgreSQL database for persistent storage and weather data caching.

> **Spatial Simplicity Note**:
> The `postgis` extension may remain enabled in Supabase as it is supported out-of-the-box and may be useful later. However, **the application does not use complex spatial queries (`ST_DWithin`, spatial radius buffers, or geography math)**.
> Location identification and cache queries use simple relational fields: `latitude`, `longitude`, `location_name`, and timestamp fields.

---

## 2. Database Schema (Simple Relational DDL)

```sql
-- Optional: PostGIS can remain enabled for future readiness, but not used in core queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Locations Table
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    state VARCHAR(100),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    -- Deterministic coordinate key (rounded to 2 decimal places for simple grouping)
    coord_key VARCHAR(50) GENERATED ALWAYS AS (
        ROUND(latitude::numeric, 2)::text || ',' || ROUND(longitude::numeric, 2)::text
    ) STORED,
    is_tracked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_coord_key ON public.locations(coord_key);
CREATE INDEX IF NOT EXISTS idx_locations_lat_lon ON public.locations(latitude, longitude);

-- 2. Weather Snapshots (Current Weather Cache)
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

-- 3. Hourly Forecast (Today's Projection)
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

-- 4. Daily Forecast (7-Day Projection)
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

---

## 3. Simple Cache Queries

### Checking Current Weather Cache (~5-minute freshness)
```sql
SELECT ws.*, l.location_name, l.country
FROM public.weather_snapshots ws
JOIN public.locations l ON ws.location_id = l.id
WHERE l.id = $locationId
  AND ws.recorded_at >= NOW() - INTERVAL '5 minutes'
ORDER BY ws.recorded_at DESC
LIMIT 1;
```

### Checking Cache by Deterministic Coordinate Key
```sql
-- Find matching location by rounded latitude/longitude key
SELECT id FROM public.locations
WHERE coord_key = ROUND($lat::numeric, 2)::text || ',' || ROUND($lon::numeric, 2)::text
LIMIT 1;
```

---

## 4. Security & Permissions
- Frontend connects only through the GraphQL API on AWS Lambda.
- Direct database mutations are performed by the backend using the Supabase `service_role` key.
- No database credentials or connection strings are ever exposed in frontend bundles.
