"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import AdminSidebar from "@/components/admin/AdminSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

type AdminBrand = {
  id: string
  slug: string
  name: string
}

export function AdminShell({
  adminBrands,
  children,
  currentSlug,
  userEmail,
}: {
  adminBrands: AdminBrand[]
  children: ReactNode
  currentSlug: string
  userEmail: string | null
}) {
  const pathname = usePathname()
  const isLogin = pathname === "/admin/login"

  if (isLogin) {
    return <>{children}</>
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AdminSidebar
          adminBrands={adminBrands}
          currentSlug={currentSlug}
          userEmail={userEmail}
        />
        <SidebarInset className="relative">
          <div className="bg-background sticky top-0 z-50 flex shrink-0 items-center gap-2 border-b p-4">
            <SidebarTrigger />
          </div>
          <div className="flex-1 overflow-auto p-8">{children}</div>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </TooltipProvider>
  )
}
