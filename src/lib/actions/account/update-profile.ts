"use server"

import { getStorefrontSession } from "@/lib/storefront-session"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function updateProfile(formData: FormData) {
  const session = await getStorefrontSession()
  if (!session) {
    return { error: "Unauthorized" }
  }

  const nameValue = formData.get("name")
  const name = typeof nameValue === "string" ? nameValue.trim() : ""
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from("profiles")
    .update({
      name: name || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.profileId)

  if (error) {
    console.error("[updateProfile]", error.message)
    return { error: "Profile error" }
  }

  return { success: true }
}
