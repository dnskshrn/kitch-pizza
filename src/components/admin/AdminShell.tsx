"use client"

import { usePathname } from "next/navigation"
import AdminSidebar from "@/components/admin/AdminSidebar"
import { Toaster } from "@/components/ui/sonner"

type AdminBrand = {
  id: string
  slug: string
  name: string
}

export function AdminShell({
  adminBrands,
  children,
  currentSlug,
}: {
  adminBrands: AdminBrand[]
  children: React.ReactNode
  currentSlug: string
}) {
  const pathname = usePathname()
  const isLogin = pathname === "/admin/login"

  if (isLogin) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar adminBrands={adminBrands} currentSlug={currentSlug} />
      <main className="flex-1 overflow-auto p-8">{children}</main>
      <Toaster />
    </div>
  )
}
