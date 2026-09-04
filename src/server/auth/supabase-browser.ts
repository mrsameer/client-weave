"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase browser configuration is missing");
  return createBrowserClient(url, key);
}

/** Supabase refreshes automatically in the browser; expose an explicit path for resumed owner sessions. */
export async function refreshOwnerBrowserSession() {
  const { data, error } = await createSupabaseBrowserClient().auth.refreshSession();
  if (error) throw error;
  return data.session;
}
