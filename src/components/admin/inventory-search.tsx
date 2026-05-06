"use client"

import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type InventorySearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function InventorySearch({
  value,
  onChange,
  placeholder,
}: InventorySearchProps) {
  const hasValue = value.length > 0

  return (
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
      <Input
        className={cn("pl-8", hasValue && "pr-9")}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hasValue ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Очистить поиск"
          onClick={() => onChange("")}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}
