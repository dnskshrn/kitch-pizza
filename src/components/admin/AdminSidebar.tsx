"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  BarChart2,
  LayoutGrid,
  UtensilsCrossed,
  Layers,
  ShoppingBag,
  Star,
  Tag,
  Ticket,
  Truck,
  LogOut,
  Package,
  FlaskConical,
  Boxes,
  ClipboardList,
  Receipt,
  ClipboardCheck,
  Warehouse,
  ChevronRight,
  Users,
  Clock,
  ArrowLeftRight,
  Trash2,
  Gift,
  Megaphone,
  FolderTree,
  Images,
  Coins,
  TrendingUp,
} from "lucide-react"
import { brands } from "@/brands"
import { BrandSwitcher } from "@/components/admin/brand-switcher"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

type NavGroup = {
  id: string
  label: string
  /** Иконка секции для свёрнутого сайдбара и collapsible-триггера */
  icon: LucideIcon
  items: NavItem[]
}

function isPathActive(pathname: string, href: string) {
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}

function groupHasActive(pathname: string, group: NavGroup) {
  return group.items.some((i) => isPathActive(pathname, i.href))
}

function buildInitialOpenState(pathname: string, groups: NavGroup[]) {
  const state: Record<string, boolean> = {}
  for (const g of groups) {
    if (g.items.length <= 1) continue
    state[g.id] = groupHasActive(pathname, g)
  }
  return state
}

const topNavGroups: NavGroup[] = [
  {
    id: "analytics",
    label: "Аналитика",
    icon: BarChart2,
    items: [
      { href: "/admin/analytics", label: "Аналитика", icon: BarChart2 },
    ],
  },
]

const brandNavGroups: NavGroup[] = [
  {
    id: "orders",
    label: "Заказы",
    icon: ShoppingBag,
    items: [{ href: "/admin/orders", label: "Заказы", icon: ShoppingBag }],
  },
  {
    id: "menu",
    label: "Меню",
    icon: UtensilsCrossed,
    items: [
      { href: "/admin/categories", label: "Категории", icon: LayoutGrid },
      { href: "/admin/menu", label: "Позиции меню", icon: UtensilsCrossed },
      { href: "/admin/toppings", label: "Топпинги", icon: Layers },
      { href: "/admin/featured-menu", label: "Популярное", icon: Star },
    ],
  },
  {
    id: "delivery",
    label: "Доставка",
    icon: Truck,
    items: [
      { href: "/admin/delivery-zones", label: "Зоны доставки", icon: Truck },
    ],
  },
]

const marketingNavGroup: NavGroup = {
  id: "marketing",
  label: "Маркетинг",
  icon: Megaphone,
  items: [
    { href: "/admin/promotions", label: "Галерея", icon: Images },
    { href: "/admin/discount-rules", label: "Акции", icon: Tag },
    { href: "/admin/promo-codes", label: "Промокоды", icon: Ticket },
    {
      href: "/admin/settings/bonus",
      label: "Программа лояльности",
      icon: Gift,
    },
  ],
}

const brandCustomersNavGroup: NavGroup = {
  id: "customers",
  label: "Клиенты",
  icon: Users,
  items: [{ href: "/admin/customers", label: "Клиенты", icon: Users }],
}

const generalNavGroups: NavGroup[] = [
  {
    id: "inventory",
    label: "Склад",
    icon: Warehouse,
    items: [
      { href: "/admin/inventory/stock", label: "Остатки", icon: Warehouse },
      { href: "/admin/inventory/suppliers", label: "Поставщики", icon: Package },
      {
        href: "/admin/inventory/ingredient-categories",
        label: "Категории ингредиентов",
        icon: FolderTree,
      },
      {
        href: "/admin/inventory/ingredients",
        label: "Ингредиенты",
        icon: FlaskConical,
      },
      {
        href: "/admin/inventory/semi-finished",
        label: "Полуфабрикаты",
        icon: Boxes,
      },
      {
        href: "/admin/inventory/tech-cards",
        label: "Техкарты",
        icon: ClipboardList,
      },
      { href: "/admin/inventory/supplies", label: "Поставки", icon: Receipt },
      {
        href: "/admin/inventory/writeoffs",
        label: "Списания",
        icon: Trash2,
      },
      {
        href: "/admin/inventory/audits",
        label: "Инвентаризации",
        icon: ClipboardCheck,
      },
      {
        href: "/admin/finance/ledger",
        label: "История движений",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    id: "cash-sessions",
    label: "Финансы",
    icon: Coins,
    items: [
      {
        href: "/admin/finances",
        label: "P&L",
        icon: TrendingUp,
      },
      {
        href: "/admin/finance/cash-sessions",
        label: "Касса",
        icon: Coins,
      },
    ],
  },
  {
    id: "staff",
    label: "Персонал",
    icon: Users,
    items: [
      { href: "/admin/staff", label: "Сотрудники", icon: Users },
      { href: "/admin/staff/shifts", label: "Смены", icon: Clock },
    ],
  },
]

const allNavGroups: NavGroup[] = [
  ...topNavGroups,
  ...brandNavGroups,
  marketingNavGroup,
  brandCustomersNavGroup,
  ...generalNavGroups,
]

function renderSidebarNavGroups(
  groups: NavGroup[],
  pathname: string,
  groupOpen: Record<string, boolean>,
  setGroupOpen: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >,
) {
  return groups.map((group) => {
    if (group.items.length === 1) {
      const { href, label, icon: Icon } = group.items[0]
      return (
        <SidebarMenuItem key={group.id}>
          <SidebarMenuButton
            asChild
            isActive={isPathActive(pathname, href)}
            tooltip={label}
          >
            <Link href={href}>
              <Icon />
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    const GroupIcon = group.icon
    return (
      <SidebarMenuItem key={group.id}>
        <Collapsible
          open={groupOpen[group.id]}
          onOpenChange={(open) =>
            setGroupOpen((s) => ({ ...s, [group.id]: open }))
          }
          className="group/collapsible w-full"
        >
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={group.label}
              isActive={groupHasActive(pathname, group)}
            >
              <GroupIcon />
              <span>{group.label}</span>
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {group.items.map(({ href, label }) => (
                <SidebarMenuSubItem key={href}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isPathActive(pathname, href)}
                  >
                    <Link href={href}>
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    )
  })
}

type AdminBrand = {
  id: string
  slug: string
  name: string
}

export default function AdminSidebar({
  adminBrands,
  currentSlug,
  userEmail,
}: {
  adminBrands: AdminBrand[]
  currentSlug: string
  userEmail: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const brand = brands.find((b) => b.slug === currentSlug) ?? brands[0]

  const [groupOpen, setGroupOpen] = React.useState<Record<string, boolean>>(
    () => buildInitialOpenState(pathname, allNavGroups)
  )

  React.useEffect(() => {
    setGroupOpen((prev) => {
      let next = prev
      let changed = false
      for (const g of allNavGroups) {
        if (g.items.length <= 1) continue
        if (groupHasActive(pathname, g) && prev[g.id] !== true) {
          if (next === prev) next = { ...prev }
          next[g.id] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
    router.refresh()
  }

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader className="border-sidebar-border border-b">
        <div className="px-2 pt-2 pb-1">
          <Link
            href="/admin/categories"
            className="focus-visible:ring-sidebar-ring inline-flex rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <Image
              src={brand.logo}
              alt={brand.name}
              width={151}
              height={70}
              className="h-[40px] w-auto object-contain object-left"
              priority
            />
          </Link>
        </div>
        <BrandSwitcher brands={adminBrands} currentSlug={currentSlug} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderSidebarNavGroups(
                topNavGroups,
                pathname,
                groupOpen,
                setGroupOpen,
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="my-1" />
        <SidebarGroup>
          <SidebarGroupLabel>Бренд</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderSidebarNavGroups(
                [...brandNavGroups, marketingNavGroup, brandCustomersNavGroup],
                pathname,
                groupOpen,
                setGroupOpen,
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="my-1" />
        <SidebarGroup>
          <SidebarGroupLabel>Общее</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderSidebarNavGroups(
                generalNavGroups,
                pathname,
                groupOpen,
                setGroupOpen,
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="bg-sidebar-accent/30 border-sidebar-border space-y-2 rounded-lg border p-3">
          <p
            className={cn(
              "truncate text-xs",
              userEmail
                ? "text-sidebar-foreground/80"
                : "text-sidebar-foreground/50"
            )}
          >
            {userEmail ?? "Нет email"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            Выйти
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
