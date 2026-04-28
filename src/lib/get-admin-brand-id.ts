import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { cookies } from "next/headers"

export async function getAdminBrandSlug(): Promise<string> {
  const cookieStore = await cookies()
  const slug = cookieStore.get("admin-brand-slug")?.value
  const supabase = createServiceRoleClient()

  if (slug) {
    const { data } = await supabase
      .from("brands")
      .select("slug")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle()

    if (data) return data.slug
  }

  const { data } = await supabase
    .from("brands")
    .select("slug")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .single()

  if (!data) throw new Error("No active brands found")
  return data.slug
}

export async function getAdminBrandId(): Promise<string> {
  const slug = await getAdminBrandSlug()
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", slug)
    .single()
  if (!data) throw new Error(`Brand not found: ${slug}`)
  return data.id
}
