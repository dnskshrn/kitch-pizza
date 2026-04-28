"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { setAdminBrand } from "@/lib/actions/set-admin-brand"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AdminBrand = {
  id: string
  slug: string
  name: string
}

export function BrandSwitcher({
  brands,
  currentSlug,
}: {
  brands: AdminBrand[]
  currentSlug: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleSwitch(slug: string) {
    if (slug === currentSlug) return

    await setAdminBrand(slug)
    router.refresh()
  }

  return (
    <div className="px-3 pb-2">
      <Select
        value={currentSlug}
        disabled={isPending}
        onValueChange={(value) => {
          startTransition(async () => {
            await handleSwitch(value)
          })
        }}
      >
        <SelectTrigger size="sm" className="h-8 w-full min-w-0">
          <SelectValue placeholder="Бренд" />
        </SelectTrigger>
        <SelectContent>
          {brands.map((b) => (
            <SelectItem
              key={b.slug}
              value={b.slug}
              onClick={() => {
                startTransition(async () => {
                  await handleSwitch(b.slug)
                })
              }}
            >
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
