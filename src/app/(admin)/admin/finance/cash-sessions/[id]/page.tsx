import { notFound } from "next/navigation"
import { getCashSessionDetail } from "@/lib/actions/admin/cash-sessions"
import { CashSessionDetailView } from "@/components/admin/finance/cash-session-detail-view"

export const dynamic = "force-dynamic"

export default async function CashSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  try {
    const detail = await getCashSessionDetail(id)
    return <CashSessionDetailView detail={detail} />
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
