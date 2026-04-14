"use client"

import { usePathname } from "next/navigation"
import AdminSidebar from "@/components/admin/AdminSidebar"
import { Toaster } from "@/components/ui/sonner"

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === "/admin/login"

  if (isLogin) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-8">{children}</main>
      <Toaster />
    </div>
  )
}
