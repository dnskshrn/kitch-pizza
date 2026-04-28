"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function getBrands(): Promise<
  { id: string; slug: string; name: string }[]
> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("brands")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("created_at")

  if (error) throw error

  return data
}
