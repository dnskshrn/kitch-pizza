import { ClientChrome } from "@/components/client/client-chrome"
import { getStorefrontCategories } from "@/lib/data/storefront-categories"
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

  return (
    <div
      className={`${interTight.className} flex min-h-screen flex-col bg-white text-foreground`}
    >
      <ClientChrome categories={categories}>{children}</ClientChrome>
    </div>
  )
}
