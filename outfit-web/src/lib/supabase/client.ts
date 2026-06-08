import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  const env = getSupabaseEnv();
  if ("error" in env) {
    throw new Error(env.error);
  }

  browserClient = createBrowserClient(env.url, env.key);
  return browserClient;
}
