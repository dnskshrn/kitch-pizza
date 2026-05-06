import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { Supplier } from "@/types/database"
import { SuppliersTable } from "./suppliers-table"

export default async function AdminInventorySuppliersPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("brand_id", brandId)
    .order("name")

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить поставщиков: {error.message}
      </p>
    )
  }

  const suppliers = (data ?? []) as Supplier[]

  return <SuppliersTable suppliers={suppliers} />
}
