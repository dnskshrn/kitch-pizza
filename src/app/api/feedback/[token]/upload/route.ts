import { randomBytes } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { OrderFeedback } from "@/types/database"

export const dynamic = "force-dynamic"

const MAX_PHOTOS = 3
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

function orderFeedbackTable(supabase: ReturnType<typeof createServiceRoleClient>) {
  return supabase.from("order_feedback") as ReturnType<typeof supabase.from>
}

function randomSuffix(length = 6): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz"
  const bytes = randomBytes(length)
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("")
}

async function countOrderPhotos(
  supabase: ReturnType<typeof createServiceRoleClient>,
  orderId: string,
): Promise<number> {
  const { data, error } = await supabase.storage
    .from("feedback-photos")
    .list(orderId)

  if (error) {
    console.error("feedback upload list error:", error.message)
    return MAX_PHOTOS
  }

  return (data ?? []).filter((item) => item.id != null).length
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token?.trim()
  if (!token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const supabase = createServiceRoleClient()
  const { data, error: loadError } = await orderFeedbackTable(supabase)
    .select("*")
    .eq("token", token)
    .maybeSingle()

  if (loadError) {
    console.error("feedback upload load error:", loadError.message)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }

  const feedback = (data as OrderFeedback | null) ?? null
  if (!feedback) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (new Date(feedback.token_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ status: "expired" }, { status: 410 })
  }
  if (feedback.submitted_at != null) {
    return NextResponse.json({ status: "already_submitted" }, { status: 409 })
  }

  const photoUrls = Array.isArray(feedback.photo_urls) ? feedback.photo_urls : []
  const storagePhotoCount = await countOrderPhotos(supabase, feedback.order_id)
  if (photoUrls.length >= MAX_PHOTOS || storagePhotoCount >= MAX_PHOTOS) {
    return NextResponse.json({ error: "Maximum 3 photos" }, { status: 400 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "File must be JPEG, PNG, or WebP" },
      { status: 400 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 })
  }

  const ext = EXT_BY_MIME[file.type] ?? "jpg"
  const path = `${feedback.order_id}/${Date.now()}-${randomSuffix()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from("feedback-photos")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error("feedback upload storage error:", uploadError.message)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  return NextResponse.json({ url: path })
}
