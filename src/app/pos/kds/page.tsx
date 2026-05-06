import { KdsScreen } from "@/components/pos/kds/kds-screen"
import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "KDS — POS",
  description: "Kitchen Display System",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true },
}

/** Подсказка для мобильных браузеров (ориентация не блокируется на уровне CSS). */
export const viewport: Viewport = {
  themeColor: "#111111",
}

export default function PosKdsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const raw = searchParams?.brand
  const initialBrandSlug = typeof raw === "string" ? raw : undefined
  return <KdsScreen initialBrandSlug={initialBrandSlug} />
}
