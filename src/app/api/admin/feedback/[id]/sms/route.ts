import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendSms } from "@/lib/sms"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id?.trim()
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const body = (await req.json()) as { message?: string }
  const message = body.message?.trim()
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data: fb } = await supabase
    .from("order_feedback")
    .select("order_id, brands(slug), orders(profiles(phone))")
    .eq("id", id)
    .single()

  const phone = (
    fb?.orders as { profiles?: { phone?: string } } | null
  )?.profiles?.phone
  const brandSlug = (fb?.brands as { slug?: string } | null)?.slug

  if (!phone) {
    return NextResponse.json({ error: "no phone" }, { status: 404 })
  }

  await sendSms({ to: phone, text: message, brandSlug })

  return NextResponse.json({ ok: true })
}
