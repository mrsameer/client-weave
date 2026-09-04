"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/owner/login?error=invalid-credentials");
  redirect("/owner/services");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/owner/login");
}

export async function refreshOwnerSession() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.refreshSession();
  return { refreshed: !error && Boolean(data.session) };
}
