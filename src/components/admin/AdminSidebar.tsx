"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  LayoutGrid,
  UtensilsCrossed,
  Layers,
  ShoppingBag,
  Star,
  Tag,
  Ticket,
  Truck,
  LogOut,
  Leaf,
} from "lucide-react"
import { brands } from "@/brands"
import { BrandSwitcher } from "@/components/admin/brand-switcher"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Аналитика",
    items: [{ href: "/admin/orders", label: "Заказы", icon: ShoppingBag }],
  },
  {
    label: "Меню",
    items: [
      { href: "/admin/categories", label: "Категории", icon: LayoutGrid },
      { href: "/admin/menu", label: "Позиции", icon: UtensilsCrossed },
      { href: "/admin/featured-menu", label: "Новое и популярное", icon: Star },
      { href: "/admin/toppings", label: "Топпинги", icon: Layers },
      { href: "/admin/condiments", label: "Кондименты", icon: Leaf },
    ],
  },
  {
    label: "Маркетинг",
    items: [
      { href: "/admin/promotions", label: "Акции", icon: Tag },
      { href: "/admin/promo-codes", label: "Промокоды", icon: Ticket },
    ],
  },
  {
    label: "Доставка",
    items: [
      { href: "/admin/delivery-zones", label: "Зоны доставки", icon: Truck },
    ],
  },
]

type AdminBrand = {
  id: string
  slug: string
  name: string
}

export default function AdminSidebar({
  adminBrands,
  currentSlug,
}: {
  adminBrands: AdminBrand[]
  currentSlug: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const brand =
    brands.find((b) => b.slug === currentSlug) ?? brands[0]

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
    router.refresh()
  }

  return (
    <aside className="bg-background sticky top-0 flex h-screen w-60 flex-shrink-0 flex-col border-r">
      <div className="border-b px-6 py-3">
        <Link
          href="/admin/categories"
          className="inline-flex focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          <Image
            src={brand.logo}
            alt={brand.name}
            width={151}
            height={70}
            className="h-[45px] w-auto object-contain object-left"
            priority
          />
        </Link>
      </div>
      <BrandSwitcher brands={adminBrands} currentSlug={currentSlug} />
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-col gap-1">
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    pathname === href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </nav>
      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="text-muted-foreground w-full justify-start gap-3"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </Button>
      </div>
    </aside>
  )
}
