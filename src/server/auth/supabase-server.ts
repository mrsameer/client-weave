import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnvironment } from "@/server/env";

export async function createSupabaseServerClient() {
  const env = getEnvironment();
  const store = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* server components cannot mutate cookies */
        }
      }
    }
  });
}
