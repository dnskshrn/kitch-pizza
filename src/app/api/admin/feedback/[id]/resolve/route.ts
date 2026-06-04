import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

function orderFeedbackTable(supabase: ReturnType<typeof createServiceRoleClient>) {
  return supabase.from("order_feedback") as ReturnType<typeof supabase.from>
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id?.trim()
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { resolution_note, resolved_by } = body as {
    resolution_note?: unknown
    resolved_by?: unknown
  }

  const note =
    typeof resolution_note === "string" ? resolution_note.trim() : ""
  const resolver =
    typeof resolved_by === "string" ? resolved_by.trim() : ""

  if (!note || !resolver) {
    return NextResponse.json(
      { error: "resolution_note and resolved_by are required" },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  const { error } = await orderFeedbackTable(supabase)
    .update({
      resolution_note: note,
      resolved_by: resolver,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    console.error("feedback resolve error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
