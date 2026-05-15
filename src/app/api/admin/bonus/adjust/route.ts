import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type Body = {
  profile_id?: string
  amount?: unknown
  note?: string
  staff_id?: string
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 500 },
    )
  }

  try {
    const profile_id =
      typeof body.profile_id === "string" ? body.profile_id.trim() : ""
    const staff_id =
      typeof body.staff_id === "string" ? body.staff_id.trim() : ""
    const note = typeof body.note === "string" ? body.note : ""
    const amountRaw =
      typeof body.amount === "number" ? body.amount : Number(body.amount)

    if (!profile_id) {
      return NextResponse.json({ error: "profile_id required" }, { status: 400 })
    }
    if (!staff_id) {
      return NextResponse.json({ error: "staff_id required" }, { status: 400 })
    }
    if (typeof body.note !== "string" || note.trim() === "") {
      return NextResponse.json({ error: "note required" }, { status: 400 })
    }
    if (
      !Number.isFinite(amountRaw) ||
      amountRaw === 0 ||
      !Number.isInteger(amountRaw)
    ) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    const delta = amountRaw

    const supabase = createServiceSupabaseClient()

    const { data: rows, error: sumError } = await supabase
      .from("bonus_transactions")
      .select("amount")
      .eq("profile_id", profile_id)

    if (sumError) {
      return NextResponse.json({ error: sumError.message }, { status: 500 })
    }

    const current = (rows ?? []).reduce(
      (s, r) => s + Number((r as { amount?: unknown }).amount ?? 0),
      0,
    )
    const newBalance = current + delta

    if (newBalance < 0) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
    }

    const type = delta > 0 ? "manual_add" : "manual_deduct"
    const rowAmount =
      delta > 0 ? Math.abs(delta) : -Math.abs(delta)

    const { error: insertError } = await supabase
      .from("bonus_transactions")
      .insert({
        profile_id,
        order_id: null,
        type,
        amount: rowAmount,
        balance_after: newBalance,
        note: note.trim(),
        created_by: staff_id,
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ balance: newBalance })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
