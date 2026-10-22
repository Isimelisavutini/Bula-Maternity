import "server-only";
import { createClient } from "@supabase/supabase-js";

function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("SUPABASE_NOT_CONFIGURED");
  return { url, anonKey };
}

export function mobileSupabase(request) {
  const { url, anonKey } = configuration();
  const authorization = request.headers.get("authorization") || "";
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function authenticatedMobileClient(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("AUTH_REQUIRED");
  const supabase = mobileSupabase(request);
  const { data, error } = await supabase.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new Error("AUTH_EXPIRED");
  return { supabase, user: data.user };
}
