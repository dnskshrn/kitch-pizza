import { AdminShell } from "@/components/admin/AdminShell"
import { getBrands } from "@/lib/actions/get-brands"
import { getAdminBrandSlug } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [adminBrands, currentSlug, supabase] = await Promise.all([
    getBrands(),
    getAdminBrandSlug(),
    createClient(),
  ])
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <AdminShell
      adminBrands={adminBrands}
      currentSlug={currentSlug}
      userEmail={user?.email ?? null}
    >
      {children}
    </AdminShell>
  )
}
