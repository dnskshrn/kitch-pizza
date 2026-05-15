import { getStorefrontSession } from "@/lib/storefront-session"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getStorefrontSession()
  if (!session) {
    return NextResponse.json({ profile: null })
  }

  const supabase = createServiceSupabaseClient()
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", session.profileId)
    .maybeSingle()

  const name = profileRow?.name ?? null

  return NextResponse.json({
    profile: {
      id: session.profileId,
      profileId: session.profileId,
      phone: session.phone,
      name,
    },
  })
}
