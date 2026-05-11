import { MaintenanceScreen } from "@/components/client/maintenance-screen"
import { ClientChrome } from "@/components/client/client-chrome"
import { getBrandBySlug } from "@/brands"
import { getStorefrontCategories } from "@/lib/data/storefront-categories"
import { headers } from "next/headers"

const MAINTENANCE_MODE = true

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const brandSlug = (await headers()).get("x-brand-slug") ?? "kitch-pizza"
  const brand = getBrandBySlug(brandSlug)

  if (MAINTENANCE_MODE) {
    return (
      <div
        data-brand={brandSlug}
        className="flex min-h-screen flex-col bg-[var(--color-bg)] text-foreground"
      >
        <MaintenanceScreen logoSrc={brand.logo} brandName={brandSlug} />
      </div>
    )
  }

  const categories = await getStorefrontCategories()

  return (
    <div
      data-brand={brandSlug}
      className="flex min-h-screen flex-col bg-[var(--color-bg)] text-foreground"
    >
      <ClientChrome brandSlug={brandSlug} categories={categories}>
        {children}
      </ClientChrome>
    </div>
  )
}
