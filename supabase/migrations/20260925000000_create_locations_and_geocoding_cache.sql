-- Migration: 20260925000000_create_locations_and_geocoding_cache.sql
-- Description: Creates persistent locations and geocoding cache tables with Row Level Security (RLS)

-- 1. Locations table
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

-- 2. Geocoding Cache table
CREATE TABLE IF NOT EXISTS public.geocoding_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL UNIQUE,
    results JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

-- 3. Indexes for performant lookup
CREATE INDEX IF NOT EXISTS idx_locations_updated_at ON public.locations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_query ON public.geocoding_cache (query);
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_expires_at ON public.geocoding_cache (expires_at);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;

-- 5. Locations RLS Policies
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

-- 6. Geocoding Cache RLS Policies
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
