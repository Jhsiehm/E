import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/lib/account/auth-mode";
import { isPrototypeSession } from "@/lib/runtime/prototype";

/** Supabase client bound to the request's auth cookies (RLS applies as the user). */
export async function supabaseServer() {
  const store = await cookies();
  if (isPrototypeSession(store))
    throw new Error("Public demo sessions cannot access the live database.");
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase is not configured");
  return createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list)
            store.set(name, value, options);
        } catch {
          // Called from a Server Component: proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
