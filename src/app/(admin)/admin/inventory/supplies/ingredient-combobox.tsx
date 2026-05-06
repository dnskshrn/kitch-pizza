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

export type IngredientComboboxIngredient = {
  id: string
  name: string
  unit: string
}

type IngredientComboboxProps = {
  value: string
  onChange: (id: string) => void
  ingredients: IngredientComboboxIngredient[]
}

export function IngredientCombobox({
  value,
  onChange,
  ingredients,
}: IngredientComboboxProps) {
  const [open, setOpen] = useState(false)

  const selected = useMemo(() => {
    if (!value) return null
    return ingredients.find((i) => i.id === value) ?? null
  }, [value, ingredients])

  const label =
    selected != null ? `${selected.name} (${selected.unit})` : undefined

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
            !label && "text-muted-foreground"
          )}
        >
          <span className="line-clamp-1 text-left">
            {label ?? "Ингредиент"}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-xl w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) => {
            const q = search.trim().toLowerCase()
            if (!q) return 1
            return itemValue.toLowerCase().includes(q) ? 1 : 0
          }}
        >
          <CommandInput placeholder="Поиск ингредиента…" />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup>
              {ingredients.map((i) => (
                <CommandItem
                  key={i.id}
                  value={`${i.name} ${i.unit}`}
                  onSelect={() => {
                    onChange(i.id)
                    setOpen(false)
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      value === i.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="line-clamp-1">
                    {i.name} ({i.unit})
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
