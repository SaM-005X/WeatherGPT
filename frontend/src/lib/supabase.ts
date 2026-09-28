/**
 * Supabase Client Initialization & Configuration Module
 *
 * Provides a resilient, type-safe Supabase client singleton for browser and server runtimes.
 *
 * Security & Design Principles:
 * 1. Uses ONLY public anonymous key (anon key). NEVER exposes service_role key to client.
 * 2. Non-blocking initialization: If Supabase credentials are missing or unreachable,
 *    the application degrades gracefully rather than throwing or crashing.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const resolvedUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

const resolvedAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

/**
 * Returns true if Supabase credentials are validly formatted and present.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    resolvedUrl &&
    resolvedAnonKey &&
    resolvedUrl.startsWith('https://') &&
    resolvedUrl.includes('.supabase.co')
  );
}

/**
 * Singleton Supabase Client instance.
 * Initialized only when credentials exist.
 * If credentials are not present, client is null and consumers should use fallback paths.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(resolvedUrl, resolvedAnonKey, {
      auth: {
        persistSession: false, // Phase 4 has no user auth
        autoRefreshToken: false,
      },
    })
  : null;

/**
 * Helper to get the active Supabase client or null.
 */
export function getSupabase(): SupabaseClient | null {
  return supabase;
}
