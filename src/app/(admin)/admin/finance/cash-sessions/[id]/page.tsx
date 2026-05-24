import { notFound } from "next/navigation"
import { getAdminSession } from "@/lib/admin-session"
import { getCashSessionDetail } from "@/lib/actions/admin/cash-sessions"
import { CashSessionDetailView } from "@/components/admin/finance/cash-session-detail-view"

export const dynamic = "force-dynamic"

const CASH_EDIT_ALLOWED = [
  "d38a6b2f-55f5-4877-a4d0-f17152b7a78d",
  "2d84ece2-2166-43b1-9df6-9a8a3e82434d",
] as const

export default async function CashSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getAdminSession()
  const canEditTransactions =
    session != null &&
    (CASH_EDIT_ALLOWED as readonly string[]).includes(session.staffId)

  try {
    const detail = await getCashSessionDetail(id)
    return (
      <CashSessionDetailView
        detail={detail}
        canEditTransactions={canEditTransactions}
      />
    )
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.toLowerCase().includes("not found")
    ) {
      notFound()
    }
    throw err
  }
}
