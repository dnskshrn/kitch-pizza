import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** Алиас для POS / клиентские подписки Realtime на anon-ключе. */
export function createBrowserSupabaseClient() {
  return createClient()
}
