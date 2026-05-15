import { getStorefrontSession } from "@/lib/storefront-session"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  const session = await getStorefrontSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const nameRaw =
    body &&
    typeof body === "object" &&
    "name" in body &&
    typeof (body as { name: unknown }).name === "string"
      ? (body as { name: string }).name.trim()
      : ""

  const supabase = createServiceSupabaseClient()
  const { error } = await supabase
    .from("profiles")
    .update({ name: nameRaw.length > 0 ? nameRaw : null })
    .eq("id", session.profileId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
