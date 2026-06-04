import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { FeedbackForm } from "@/components/feedback/FeedbackForm"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { OrderFeedback } from "@/types/database"

export const dynamic = "force-dynamic"

type PageProps = {
  params: { token: string }
}

type FeedbackPageState =
  | { kind: "expired"; brandSlug: string }
  | { kind: "already_submitted"; brandSlug: string }
  | { kind: "open"; brandSlug: string; token: string }

function orderFeedbackTable(supabase: ReturnType<typeof createServiceRoleClient>) {
  return supabase.from("order_feedback") as ReturnType<typeof supabase.from>
}

async function resolvePageState(token: string): Promise<FeedbackPageState | null> {
  const supabase = createServiceRoleClient()

  const { data, error } = await orderFeedbackTable(supabase)
    .select("*")
    .eq("token", token)
    .maybeSingle()

  if (error || !data) return null

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

  return { kind: "open", brandSlug, token }
}

const feedbackShellClass =
  "flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4 text-[var(--color-text)]"

function StatusCard({
  brandSlug,
  children,
}: {
  brandSlug: string
  children: ReactNode
}) {
  return (
    <div
      data-brand={brandSlug}
      data-theme="light"
      className={feedbackShellClass}
    >
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--color-bg)] p-8 text-center text-[var(--color-text)] shadow-sm">
        {children}
      </div>
    </div>
  )
}

export default async function FeedbackPage({ params }: PageProps) {
  const token = params.token?.trim()
  if (!token) notFound()

  const state = await resolvePageState(token)
  if (!state) notFound()

  if (state.kind === "expired") {
    return (
      <StatusCard brandSlug={state.brandSlug}>
        <p className="text-lg font-semibold">Link expirat</p>
        <p className="mt-2 text-[var(--color-muted)]">Ссылка устарела</p>
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
