import type { Metadata } from "next"
import { AuthInitializer } from "@/components/client/auth/auth-initializer"
import { MaintenanceScreen } from "@/components/client/maintenance-screen"
import { ClientChrome } from "@/components/client/client-chrome"
import StoreClosedModal from "@/components/store-closed-modal"
import { WelcomeBonusModal } from "@/components/client/welcome-bonus-modal"
import { StorefrontTopBar } from "@/components/client/storefront-top-bar"
import { BrandJsonLd } from "@/components/seo/JsonLd"
import { MetaPixel } from "@/components/MetaPixel"
import { Toaster } from "@/components/ui/sonner"
import { getBrandBySlug } from "@/brands"
import { getStorefrontCategories } from "@/lib/data/storefront-categories"
import { getBrandSeo } from "@/lib/seo/brand-seo"
import { headers } from "next/headers"

const MAINTENANCE_MODE = false

export async function generateMetadata(): Promise<Metadata> {
  const brandSlug = (await headers()).get("x-brand-slug") ?? "kitch-pizza"
  const seo = getBrandSeo(brandSlug)

  return {
    title: {
      default: seo.titleRo,
      template: `%s | ${seo.siteName}`,
    },
    description: seo.descriptionRo,
    keywords: seo.keywords,
    metadataBase: new URL(seo.canonicalUrl),
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: seo.titleRo,
      description: seo.descriptionRo,
      url: seo.canonicalUrl,
      siteName: seo.siteName,
      locale: seo.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.titleRo,
      description: seo.descriptionRo,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
  }
}

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
        <StoreClosedModal brandSlug={brandSlug} />
        <WelcomeBonusModal />
        <BrandJsonLd brandSlug={brandSlug} />
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
      <StoreClosedModal brandSlug={brandSlug} />
      <WelcomeBonusModal />
      <BrandJsonLd brandSlug={brandSlug} />
      <MetaPixel pixelId={brand.metaPixelId} />
      <StorefrontTopBar brandSlug={brandSlug} />
      <ClientChrome brandSlug={brandSlug} categories={categories}>
        {children}
      </ClientChrome>
      <Toaster position="top-center" richColors />
    </div>
  )
}
