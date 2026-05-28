// Server-side Supabase clients. Two flavours:
//   * supabaseServer()      — runs as the calling user (RLS applies)
//   * supabaseService()     — service role, bypasses RLS. Server-only.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

interface CookieToSet { name: string; value: string; options?: CookieOptions }

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(toSet: CookieToSet[]) {
        try { toSet.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server Components can't set; ignored. */ }
      },
    },
  });
}

export function supabaseService() {
  if (!env.supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required for service-role calls.");
  }
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
