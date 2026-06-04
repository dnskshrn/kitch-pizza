import { NextRequest, NextResponse } from "next/server"
import { isNegativeFeedback } from "@/lib/feedback"
import { sendNegativeFeedbackTelegram } from "@/lib/feedback-telegram"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { OrderFeedback } from "@/types/database"

export const dynamic = "force-dynamic"

type FeedbackStatus =
  | { status: "expired" }
  | { status: "already_submitted" }
  | { status: "open"; brand_slug: string }

function orderFeedbackTable(supabase: ReturnType<typeof createServiceRoleClient>) {
  return supabase.from("order_feedback") as ReturnType<typeof supabase.from>
}

async function loadFeedbackByToken(
  token: string,
): Promise<{ feedback: OrderFeedback | null; error?: string }> {
  const supabase = createServiceRoleClient()
  const { data, error } = await orderFeedbackTable(supabase)
    .select("*")
    .eq("token", token)
    .maybeSingle()

  if (error) {
    return { feedback: null, error: error.message }
  }

  return { feedback: (data as OrderFeedback | null) ?? null }
}

function resolveFeedbackStatus(
  feedback: OrderFeedback,
  brandSlug: string | null,
): FeedbackStatus | "not_found" {
  if (new Date(feedback.token_expires_at).getTime() < Date.now()) {
    return { status: "expired" }
  }
  if (feedback.submitted_at != null) {
    return { status: "already_submitted" }
  }
  if (!brandSlug) {
    return "not_found"
  }
  return { status: "open", brand_slug: brandSlug }
}

async function getBrandSlug(
  supabase: ReturnType<typeof createServiceRoleClient>,
  brandId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("brands")
    .select("slug")
    .eq("id", brandId)
    .maybeSingle()

  if (error || !data) return null
  return typeof data.slug === "string" ? data.slug : null
}

function parseRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null
  if (value < 1 || value > 5) return null
  return value
}

function parsePhotoUrls(
  value: unknown,
  orderId: string,
): string[] | null | "invalid" {
  if (value == null) return null
  if (!Array.isArray(value)) return "invalid"
  if (value.length === 0) return []
  if (value.length > 3) return "invalid"
  for (const item of value) {
    if (typeof item !== "string") return "invalid"
    const path = item.trim()
    if (!path.startsWith(`${orderId}/`) || path.includes("..")) {
      return "invalid"
    }
  }
  return value.map((item) => (item as string).trim())
}

async function removeOrphanFeedbackPhotos(
  supabase: ReturnType<typeof createServiceRoleClient>,
  orderId: string,
  keepPaths: string[],
): Promise<void> {
  const { data, error } = await supabase.storage
    .from("feedback-photos")
    .list(orderId)

  if (error || !data?.length) return

  const keep = new Set(keepPaths)
  const toRemove = data
    .filter((item) => item.id != null)
    .map((item) => `${orderId}/${item.name}`)
    .filter((path) => !keep.has(path))

  if (toRemove.length === 0) return

  await supabase.storage.from("feedback-photos").remove(toRemove)
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token?.trim()
  if (!token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { feedback, error } = await loadFeedbackByToken(token)
  if (error) {
    console.error("feedback GET load error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
  if (!feedback) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const supabase = createServiceRoleClient()
  const brandSlug = await getBrandSlug(supabase, feedback.brand_id)
  const status = resolveFeedbackStatus(feedback, brandSlug)
  if (status === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(status)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token?.trim()
  if (!token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
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

  const { food_rating, service_rating, comment, photo_urls } = body as {
    food_rating?: unknown
    service_rating?: unknown
    comment?: unknown
    photo_urls?: unknown
  }

  const foodRating = parseRating(food_rating)
  const serviceRating = parseRating(service_rating)
  if (foodRating == null || serviceRating == null) {
    return NextResponse.json({ error: "Invalid ratings" }, { status: 400 })
  }

  let commentText: string | null = null
  if (comment != null) {
    if (typeof comment !== "string") {
      return NextResponse.json({ error: "Invalid comment" }, { status: 400 })
    }
    const trimmed = comment.trim()
    commentText = trimmed.length > 0 ? trimmed.slice(0, 500) : null
  }

  const { feedback, error: loadError } = await loadFeedbackByToken(token)
  if (loadError) {
    console.error("feedback POST load error:", loadError)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
  if (!feedback) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const supabase = createServiceRoleClient()
  const brandSlug = await getBrandSlug(supabase, feedback.brand_id)
  const status = resolveFeedbackStatus(feedback, brandSlug)
  if (status === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (status.status === "expired") {
    return NextResponse.json({ status: "expired" }, { status: 410 })
  }
  if (status.status === "already_submitted") {
    return NextResponse.json({ status: "already_submitted" }, { status: 409 })
  }

  const parsedPhotoUrls = parsePhotoUrls(photo_urls, feedback.order_id)
  if (parsedPhotoUrls === "invalid") {
    return NextResponse.json({ error: "Invalid photo_urls" }, { status: 400 })
  }

  const submittedAt = new Date().toISOString()
  const updatePayload: Record<string, unknown> = {
    food_rating: foodRating,
    service_rating: serviceRating,
    comment: commentText,
    submitted_at: submittedAt,
  }
  if (parsedPhotoUrls != null && parsedPhotoUrls.length > 0) {
    updatePayload.photo_urls = parsedPhotoUrls
    await removeOrphanFeedbackPhotos(
      supabase,
      feedback.order_id,
      parsedPhotoUrls,
    )
  }

  const { error: updateError } = await orderFeedbackTable(supabase)
    .update(updatePayload)
    .eq("token", token)

  if (updateError) {
    console.error("feedback POST update error:", updateError.message)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }

  if (isNegativeFeedback(foodRating, serviceRating)) {
    const { data: enrichment, error: enrichmentError } = await supabase
      .from("orders")
      .select(
        "brands(name), profiles(phone), courier:staff!orders_courier_id_fkey(name)",
      )
      .eq("id", feedback.order_id)
      .maybeSingle()

    if (enrichmentError) {
      console.error("feedback POST enrichment error:", enrichmentError.message)
    } else if (enrichment) {
      const brand = unwrapOne(
        (enrichment as { brands?: { name?: string } | { name?: string }[] | null })
          .brands,
      )
      const profile = unwrapOne(
        (
          enrichment as {
            profiles?: { phone?: string | null } | { phone?: string | null }[] | null
          }
        ).profiles,
      )
      const courier = unwrapOne(
        (
          enrichment as {
            courier?: { name?: string } | { name?: string }[] | null
          }
        ).courier,
      )

      const tgMessageId = await sendNegativeFeedbackTelegram({
        feedback_id: feedback.id,
        order_id: feedback.order_id,
        brand_name:
          typeof brand?.name === "string" && brand.name.trim()
            ? brand.name.trim()
            : "—",
        customer_phone:
          typeof profile?.phone === "string" && profile.phone.trim()
            ? profile.phone.trim()
            : null,
        courier_name:
          typeof courier?.name === "string" && courier.name.trim()
            ? courier.name.trim()
            : null,
        food_rating: foodRating,
        service_rating: serviceRating,
        comment: commentText,
        photo_urls:
          parsedPhotoUrls != null && parsedPhotoUrls.length > 0
            ? parsedPhotoUrls
            : null,
      })

      if (tgMessageId != null) {
        const { error: notifyError } = await orderFeedbackTable(supabase)
          .update({
            tg_message_id: tgMessageId,
            tg_notified: true,
          })
          .eq("id", feedback.id)

        if (notifyError) {
          console.error("feedback POST tg notify update error:", notifyError.message)
        }
      }
    }
  }

  return NextResponse.json({ success: true })
}
