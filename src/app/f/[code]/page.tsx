import type { ReactNode } from "react"
import { FeedbackForm } from "@/components/feedback/FeedbackForm"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { OrderFeedback } from "@/types/database"

export const dynamic = "force-dynamic"

type PageProps = {
  params: { code: string }
}

type ShortFeedbackState =
  | { kind: "invalid" }
  | { kind: "expired"; brandSlug: string }
  | { kind: "already_submitted"; brandSlug: string }
  | { kind: "open"; brandSlug: string; token: string }

function orderFeedbackTable(supabase: ReturnType<typeof createServiceRoleClient>) {
  return supabase.from("order_feedback") as ReturnType<typeof supabase.from>
}

async function resolveShortFeedbackState(
  code: string,
): Promise<ShortFeedbackState> {
  const supabase = createServiceRoleClient()

  const { data, error } = await orderFeedbackTable(supabase)
    .select("*")
    .eq("short_code", code)
    .maybeSingle()

  if (error || !data) {
    return { kind: "invalid" }
  }

  const feedback = data as OrderFeedback

  const { data: brandRow } = await supabase
    .from("brands")
    .select("slug")
    .eq("id", feedback.brand_id)
    .maybeSingle()

  const brandSlug =
    brandRow && typeof brandRow.slug === "string" ? brandRow.slug : "losos"

  if (new Date(feedback.token_expires_at).getTime() < Date.now()) {
    return { kind: "expired", brandSlug }
  }

  if (feedback.submitted_at != null) {
    return { kind: "already_submitted", brandSlug }
  }

  return { kind: "open", brandSlug, token: feedback.token }
}

const feedbackShellClass =
  "flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4 text-[var(--color-text)]"

function StatusCard({
  brandSlug,
  children,
}: {
  brandSlug?: string
  children: ReactNode
}) {
  return (
    <div
      data-brand={brandSlug ?? "losos"}
      data-theme="light"
      className={feedbackShellClass}
    >
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--color-bg)] p-8 text-center text-[var(--color-text)] shadow-sm">
        {children}
      </div>
    </div>
  )
}

export default async function ShortFeedbackPage({ params }: PageProps) {
  const code = params.code?.trim().toLowerCase()
  if (!code) {
    return (
      <StatusCard>
        <p className="text-lg font-semibold">Link invalid</p>
      </StatusCard>
    )
  }

  const state = await resolveShortFeedbackState(code)

  if (state.kind === "invalid") {
    return (
      <StatusCard>
        <p className="text-lg font-semibold">Link invalid</p>
      </StatusCard>
    )
  }

  if (state.kind === "expired") {
    return (
      <StatusCard brandSlug={state.brandSlug}>
        <p className="text-lg font-semibold">Link expirat</p>
      </StatusCard>
    )
  }

  if (state.kind === "already_submitted") {
    return (
      <StatusCard brandSlug={state.brandSlug}>
        <p className="text-lg font-semibold">
          Mulțumim! Recenzia ta a fost înregistrată 🙏
        </p>
      </StatusCard>
    )
  }

  return (
    <div
      data-brand={state.brandSlug}
      data-theme="light"
      className={feedbackShellClass}
    >
      <FeedbackForm token={state.token} brandSlug={state.brandSlug} />
    </div>
  )
}
