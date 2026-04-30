"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { brands } from "@/brands"
import { BrandSwitcher } from "@/components/admin/brand-switcher"
import {
  LayoutGrid,
  UtensilsCrossed,
  Layers,
  ShoppingBag,
  Star,
  Tag,
  Ticket,
  Truck,
  Images,
  LogOut,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/admin/orders", label: "Заказы", icon: ShoppingBag },
  { href: "/admin/categories", label: "Категории", icon: LayoutGrid },
  { href: "/admin/menu", label: "Меню", icon: UtensilsCrossed },
  { href: "/admin/featured-menu", label: "Новое и популярное", icon: Star },
  { href: "/admin/toppings", label: "Топпинги", icon: Layers },
  { href: "/admin/promotions", label: "Акции", icon: Tag },
  { href: "/admin/promo-codes", label: "Промокоды", icon: Ticket },
  { href: "/admin/delivery-zones", label: "Зоны доставки", icon: Truck },
  { href: "/admin/gallery", label: "Галерея", icon: Images, disabled: true },
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
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ href, label, icon: Icon, disabled }) =>
          disabled ? (
            <div
              key={href}
              className="text-muted-foreground/50 flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm"
            >
              <Icon className="h-4 w-4" />
              {label}
            </div>
          ) : (
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
          )
        )}
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
