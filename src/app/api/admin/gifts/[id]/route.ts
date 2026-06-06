import { createServiceSupabaseClient } from "@/lib/supabase/server"
import type { CustomerGiftStatus } from "@/types/database"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function customerGiftsTable(supabase: ReturnType<typeof createServiceSupabaseClient>) {
  return supabase.from("customer_gifts") as ReturnType<typeof supabase.from>
}

type PatchBody = {
  status?: string
  fulfilled_by?: string
  fulfilled_order_id?: string
  cancelled_reason?: string
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id?.trim()
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const status = body.status?.trim() as CustomerGiftStatus | undefined
  if (!status || !["pending", "given", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const patch: Record<string, unknown> = { status }

  if (typeof body.fulfilled_by === "string" && body.fulfilled_by.trim()) {
    patch.fulfilled_by = body.fulfilled_by.trim()
  }
  if (
    typeof body.fulfilled_order_id === "string" &&
    body.fulfilled_order_id.trim()
  ) {
    patch.fulfilled_order_id = body.fulfilled_order_id.trim()
  }
  if (typeof body.cancelled_reason === "string" && body.cancelled_reason.trim()) {
    patch.cancelled_reason = body.cancelled_reason.trim()
  }

  if (status === "given") {
    patch.fulfilled_at = new Date().toISOString()
  }

  const supabase = createServiceSupabaseClient()
  const { data, error } = await customerGiftsTable(supabase)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
