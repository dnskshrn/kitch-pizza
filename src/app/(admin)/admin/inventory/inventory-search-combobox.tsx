"use client"

import { useMemo, useState } from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type InventorySearchComboboxOption = {
  id: string
  name: string
  /** Отображается в скобках после названия, напр. «кг» или «г» */
  suffix?: string
}

type InventorySearchComboboxProps = {
  value: string
  onChange: (id: string) => void
  options: InventorySearchComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  triggerClassName?: string
}

function containsFilter(itemValue: string, search: string): number {
  const q = search.trim().toLowerCase()
  if (!q) return 1
  return itemValue.toLowerCase().includes(q) ? 1 : 0
}

export function InventorySearchCombobox({
  value,
  onChange,
  options,
  placeholder = "Выберите…",
  searchPlaceholder = "Поиск…",
  triggerClassName,
}: InventorySearchComboboxProps) {
  const [open, setOpen] = useState(false)

  const selected = useMemo(() => {
    if (!value) return null
    return options.find((o) => o.id === value) ?? null
  }, [value, options])

  const label =
    selected != null
      ? selected.suffix
        ? `${selected.name} (${selected.suffix})`
        : selected.name
      : undefined

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 w-full justify-between gap-1 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm font-normal shadow-none hover:bg-transparent dark:bg-input/30 dark:hover:bg-input/50",
            !label && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="line-clamp-1 text-left">{label ?? placeholder}</span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-xl w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg p-0"
        align="start"
      >
        <Command filter={containsFilter}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.suffix ? `${o.name} ${o.suffix}` : o.name}
                  onSelect={() => {
                    onChange(o.id)
                    setOpen(false)
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      value === o.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="line-clamp-1">
                    {o.suffix ? `${o.name} (${o.suffix})` : o.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
