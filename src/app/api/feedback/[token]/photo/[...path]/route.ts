import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/admin-session"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string; path: string[] } },
) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = params.token?.trim()
  const segments = params.path
  if (!token || !segments?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const storagePath = segments.map((s) => decodeURIComponent(s)).join("/")
  if (!storagePath || storagePath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.storage
    .from("feedback-photos")
    .createSignedUrl(storagePath, 3600)

  if (error || !data?.signedUrl) {
    console.error("feedback photo signed URL error:", error?.message)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
