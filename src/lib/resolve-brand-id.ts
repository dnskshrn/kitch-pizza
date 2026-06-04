import { getBrandBySlug } from "@/brands"
import { createServiceSupabaseClient } from "@/lib/supabase/server"

/** UUID бренда по slug витрины (`kitch-pizza`, `losos`, `the-spot`, …). */
export async function resolveBrandIdBySlug(brandSlug: string): Promise<string | null> {
  const brand = getBrandBySlug(brandSlug)
  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", brand.slug)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id as string
}
