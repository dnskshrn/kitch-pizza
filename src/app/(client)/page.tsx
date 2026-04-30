import { ClientContainer } from "@/components/client/client-container"
import { FeaturedMenuSection } from "@/components/client/featured-menu-section"
import { MenuCategoryBar } from "@/components/client/menu-category-bar"
import { MenuSection } from "@/components/client/menu-section"
import { PromotionsSlider } from "@/components/client/promotions-slider"
import { getStorefrontFeaturedMenuItems } from "@/lib/data/storefront-featured-menu"
import { getStorefrontMenu } from "@/lib/data/storefront-menu"
import { getStorefrontPromotions } from "@/lib/data/storefront-promotions"
import { headers } from "next/headers"

function isBoutiqueBrand(brandSlug: string): boolean {
  return brandSlug === "the-spot" || brandSlug === "losos"
}

export default async function HomePage() {
  const brandSlug = (await headers()).get("x-brand-slug") ?? "kitch-pizza"
  const hasBoutiqueLayout = isBoutiqueBrand(brandSlug)
  const [promotions, menu, featuredMenuItems] = await Promise.all([
    getStorefrontPromotions(),
    getStorefrontMenu(),
    getStorefrontFeaturedMenuItems(),
  ])

  return (
    <ClientContainer
      className="py-10 data-[brand=the-spot]:px-4 data-[brand=the-spot]:pb-28 data-[brand=the-spot]:pt-3 data-[brand=losos]:max-w-[1180px] data-[brand=losos]:px-4 data-[brand=losos]:pb-28 data-[brand=losos]:pt-3 md:data-[brand=the-spot]:pb-16 md:data-[brand=the-spot]:pt-2 md:data-[brand=losos]:pb-16 md:data-[brand=losos]:pt-2 xl:data-[brand=losos]:px-0"
      data-brand={brandSlug}
    >
      <PromotionsSlider brandSlug={brandSlug} promotions={promotions} />
      {hasBoutiqueLayout ? (
        <MenuCategoryBar
          brandSlug={brandSlug}
          categories={menu.map(({ category }) => category)}
        />
      ) : null}
      <FeaturedMenuSection brandSlug={brandSlug} items={featuredMenuItems} />
      <MenuSection brandSlug={brandSlug} data={menu} />
    </ClientContainer>
  )
}
