import { endOfDay, parseISO, startOfDay } from "date-fns"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { isNegativeFeedback } from "@/lib/feedback"
import type { OrderFeedback } from "@/types/database"

export type FeedbackMetrics = {
  avg_food: number | null
  avg_service: number | null
  total_submitted: number
  total_sms_sent: number
  conversion_pct: number | null
  negative_count: number
  negative_pct: number | null
}

export type FeedbackRow = OrderFeedback & {
  brand_name: string
  brand_slug: string
  customer_phone: string | null
  customer_name: string | null
  courier_name: string | null
}

export type FeedbackPageData = {
  metrics: FeedbackMetrics
  feedbacks: FeedbackRow[]
}

type MaybeJoin<T> = T | T[] | null | undefined

function unwrapOne<T>(value: MaybeJoin<T>): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function orderFeedbackTable(supabase: ReturnType<typeof createServiceSupabaseClient>) {
  return supabase.from("order_feedback") as ReturnType<typeof supabase.from>
}

function applyDateFilters<
  Q extends {
    gte: (col: string, val: string) => Q
    lte: (col: string, val: string) => Q
  },
>(query: Q, from?: string, to?: string): Q {
  let q = query
  if (from) {
    q = q.gte("submitted_at", startOfDay(parseISO(from.slice(0, 10))).toISOString())
  }
  if (to) {
    q = q.lte("submitted_at", endOfDay(parseISO(to.slice(0, 10))).toISOString())
  }
  return q
}

function computeMetrics(
  rows: Array<{
    food_rating: number | null
    service_rating: number | null
    submitted_at: string | null
    sms_sent_at: string | null
  }>,
): FeedbackMetrics {
  const submitted = rows.filter((r) => r.submitted_at != null)
  const total_submitted = submitted.length
  const total_sms_sent = rows.filter((r) => r.sms_sent_at != null).length

  const foodRatings = submitted
    .map((r) => r.food_rating)
    .filter((r): r is number => r != null)
  const serviceRatings = submitted
    .map((r) => r.service_rating)
    .filter((r): r is number => r != null)

  const avg_food =
    foodRatings.length > 0
      ? Math.round(
          (foodRatings.reduce((a, b) => a + b, 0) / foodRatings.length) * 10,
        ) / 10
      : null
  const avg_service =
    serviceRatings.length > 0
      ? Math.round(
          (serviceRatings.reduce((a, b) => a + b, 0) / serviceRatings.length) *
            10,
        ) / 10
      : null

  const negative_count = submitted.filter((r) =>
    isNegativeFeedback(r.food_rating, r.service_rating),
  ).length

  const conversion_pct =
    total_sms_sent > 0
      ? Math.round((total_submitted / total_sms_sent) * 1000) / 10
      : null
  const negative_pct =
    total_submitted > 0
      ? Math.round((negative_count / total_submitted) * 1000) / 10
      : null

  return {
    avg_food,
    avg_service,
    total_submitted,
    total_sms_sent,
    conversion_pct,
    negative_count,
    negative_pct,
  }
}

export async function fetchFeedbackPageData(
  brandFilter?: string,
  from?: string,
  to?: string,
): Promise<FeedbackPageData> {
  const supabase = createServiceSupabaseClient()
  const brandSlug = brandFilter?.trim() || undefined

  let metricsQuery = orderFeedbackTable(supabase).select(
    "food_rating, service_rating, submitted_at, sms_sent_at, brands!inner(slug)",
  )

  if (brandSlug) {
    metricsQuery = metricsQuery.eq("brands.slug", brandSlug)
  }
  metricsQuery = applyDateFilters(metricsQuery, from, to)

  const { data: metricsRows, error: metricsError } = await metricsQuery

  if (metricsError) {
    throw new Error(metricsError.message)
  }

  let feedbacksQuery = orderFeedbackTable(supabase)
    .select(
      `
      *,
      brands!inner(name, slug),
      orders!inner(
        profiles(phone, name),
        courier:staff!orders_courier_id_fkey(name)
      )
    `,
    )
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(100)

  if (brandSlug) {
    feedbacksQuery = feedbacksQuery.eq("brands.slug", brandSlug)
  }
  feedbacksQuery = applyDateFilters(feedbacksQuery, from, to)

  const { data: feedbackRows, error: feedbacksError } = await feedbacksQuery

  if (feedbacksError) {
    throw new Error(feedbacksError.message)
  }

  const feedbacks: FeedbackRow[] = (feedbackRows ?? []).map((row) => {
    const r = row as OrderFeedback & {
      brands?: MaybeJoin<{ name?: string; slug?: string }>
      orders?: MaybeJoin<{
        profiles?: MaybeJoin<{ phone?: string | null; name?: string | null }>
        courier?: MaybeJoin<{ name?: string }>
      }>
    }
    const brand = unwrapOne(r.brands)
    const order = unwrapOne(r.orders)
    const profile = unwrapOne(order?.profiles)
    const courier = unwrapOne(order?.courier)

    return {
      ...r,
      brand_name: brand?.name?.trim() || "—",
      brand_slug: brand?.slug?.trim() || "",
      customer_phone:
        typeof profile?.phone === "string" && profile.phone.trim()
          ? profile.phone.trim()
          : null,
      customer_name:
        typeof profile?.name === "string" && profile.name.trim()
          ? profile.name.trim()
          : null,
      courier_name:
        typeof courier?.name === "string" && courier.name.trim()
          ? courier.name.trim()
          : null,
    }
  })

  return {
    metrics: computeMetrics(
      (metricsRows ?? []) as Array<{
        food_rating: number | null
        service_rating: number | null
        submitted_at: string | null
        sms_sent_at: string | null
      }>,
    ),
    feedbacks,
  }
}
