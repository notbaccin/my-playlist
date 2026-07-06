import { createClient } from "@supabase/supabase-js";

// Usa a service_role key: só roda no servidor (API routes), nunca exponha no client.
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados.");
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}
