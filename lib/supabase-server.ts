import { createClient } from "@supabase/supabase-js";

export const REQUIRED_SUPABASE_PROJECT = "fnkkeadpkjshsnjmoznl";

export function getSupabaseProjectRef(url: string) {
  return url.match(/^https:\/\/([^.]+)\.supabase\.co\/?$/)?.[1] || "unknown";
}

export function createServerDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (getSupabaseProjectRef(url) !== REQUIRED_SUPABASE_PROJECT) {
    throw new Error(`Supabase project must be ${REQUIRED_SUPABASE_PROJECT}.`);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServerAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (getSupabaseProjectRef(url) !== REQUIRED_SUPABASE_PROJECT) {
    throw new Error(`Supabase project must be ${REQUIRED_SUPABASE_PROJECT}.`);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
