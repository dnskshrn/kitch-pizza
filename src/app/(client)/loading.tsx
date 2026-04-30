import { StorefrontHomeSkeleton } from "@/components/client/storefront-skeletons"
import { headers } from "next/headers"

export default async function Loading() {
  const brandSlug = (await headers()).get("x-brand-slug") ?? "kitch-pizza"

  return <StorefrontHomeSkeleton brandSlug={brandSlug} />
}
