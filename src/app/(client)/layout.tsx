import { ClientChrome } from "@/components/client/client-chrome"
import { getStorefrontCategories } from "@/lib/data/storefront-categories"
import { headers } from "next/headers"
import { Inter_Tight } from "next/font/google"

const interTight = Inter_Tight({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  weight: ["400", "500", "700", "900"],
  style: ["normal", "italic"],
})

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const categories = await getStorefrontCategories()
  const brandSlug = (await headers()).get("x-brand-slug") ?? "kitch-pizza"

  return (
    <div
      data-brand={brandSlug}
      className={`${interTight.className} flex min-h-screen flex-col bg-[var(--color-bg)] text-foreground`}
    >
      <ClientChrome brandSlug={brandSlug} categories={categories}>
        {children}
      </ClientChrome>
    </div>
  )
}
