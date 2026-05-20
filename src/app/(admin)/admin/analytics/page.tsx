import { getAnalyticsData } from "@/lib/actions/admin/analytics"
import { createClient } from "@/lib/supabase/server"
import AnalyticsDashboard from "@/components/admin/analytics/AnalyticsDashboard"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug")
    .order("name")

  const initialData = await getAnalyticsData({ days: 30 })

  return (
    <div className="space-y-6 p-6">
      <AnalyticsDashboard
        initialData={initialData}
        brands={brands ?? []}
      />
    </div>
  )
}
