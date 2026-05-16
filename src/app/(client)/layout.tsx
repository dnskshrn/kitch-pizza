import { AuthInitializer } from "@/components/client/auth/auth-initializer"
import { MaintenanceScreen } from "@/components/client/maintenance-screen"
import { ClientChrome } from "@/components/client/client-chrome"
import { StorefrontTopBar } from "@/components/client/storefront-top-bar"
import { MetaPixel } from "@/components/MetaPixel"
import { getBrandBySlug } from "@/brands"
import { getStorefrontCategories } from "@/lib/data/storefront-categories"
import { headers } from "next/headers"

const MAINTENANCE_MODE = false

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
        <MetaPixel pixelId={brand.metaPixelId} />
        <AuthInitializer />
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
      <MetaPixel pixelId={brand.metaPixelId} />
      <StorefrontTopBar brandSlug={brandSlug} />
      <ClientChrome brandSlug={brandSlug} categories={categories}>
        {children}
      </ClientChrome>
    </div>
  )
}
