import { ClientContainer } from "@/components/client/client-container"
import { MenuSection } from "@/components/client/menu-section"
import { PromotionsSlider } from "@/components/client/promotions-slider"
import { getStorefrontMenu } from "@/lib/data/storefront-menu"
import { getStorefrontPromotions } from "@/lib/data/storefront-promotions"

export default async function HomePage() {
  const [promotions, menu] = await Promise.all([
    getStorefrontPromotions(),
    getStorefrontMenu(),
  ])

  return (
    <ClientContainer className="py-10">
      <PromotionsSlider promotions={promotions} />
      <MenuSection data={menu} />
    </ClientContainer>
  )
}
