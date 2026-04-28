import { AdminShell } from "@/components/admin/AdminShell"
import { getBrands } from "@/lib/actions/get-brands"
import { getAdminBrandSlug } from "@/lib/get-admin-brand-id"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [adminBrands, currentSlug] = await Promise.all([
    getBrands(),
    getAdminBrandSlug(),
  ])

  return (
    <AdminShell adminBrands={adminBrands} currentSlug={currentSlug}>
      {children}
    </AdminShell>
  )
}
