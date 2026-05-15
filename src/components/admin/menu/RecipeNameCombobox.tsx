"use client"

import { useMemo, useState } from "react"
import { recipeEditorStorageUnitShort } from "@/lib/recipe-editor-qty"
import type {
  RecipeCompositionIngredient,
  RecipeCompositionSemi,
} from "@/lib/recipe-composition-types"
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
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type RecipeNameComboboxRow = {
  type: "ingredient" | "semi" | "menu_ref"
  ref_id: string
}

export function RecipeNameCombobox({
  row,
  ingredients,
  semis,
  onPick,
  disabled,
}: {
  row: RecipeNameComboboxRow
  ingredients: RecipeCompositionIngredient[]
  semis: RecipeCompositionSemi[]
  onPick: (type: "ingredient" | "semi", refId: string) => void
  disabled?: boolean
}) {
  const [comboOpen, setComboOpen] = useState(false)

  const label = useMemo(() => {
    if (!row.ref_id) return ""
    if (row.type === "ingredient") {
      const i = ingredients.find((x) => x.id === row.ref_id)
      return i ? `${i.name} (${recipeEditorStorageUnitShort(i.unit)})` : ""
    }
    const s = semis.find((x) => x.id === row.ref_id)
    return s ? `${s.name} (${recipeEditorStorageUnitShort(s.yield_unit)})` : ""
  }, [ingredients, row.ref_id, row.type, semis])

  return (
    <Popover open={comboOpen} onOpenChange={setComboOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-expanded={comboOpen}
          className={cn(
            "h-9 w-full min-w-[10rem] justify-between font-normal",
            !label && "text-muted-foreground",
          )}
        >
          <span className="line-clamp-1 text-left">
            {label || "Выберите…"}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,32rem)] overflow-hidden p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) => {
            const q = search.trim().toLowerCase()
            if (!q) return 1
            return itemValue.toLowerCase().includes(q) ? 1 : 0
          }}
        >
          <CommandInput placeholder="Поиск…" />
          <CommandList>
            <CommandEmpty className="text-muted-foreground">
              Ничего не найдено
            </CommandEmpty>
            <CommandGroup heading="Ингредиенты">
              {ingredients.map((i) => (
                <CommandItem
                  key={i.id}
                  value={`ingredient-${i.id}-${i.name}`}
                  onSelect={() => {
                    onPick("ingredient", i.id)
                    setComboOpen(false)
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      row.type === "ingredient" && row.ref_id === i.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {i.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Полуфабрикаты">
              {semis.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`semi-${s.id}-${s.name}`}
                  onSelect={() => {
                    onPick("semi", s.id)
                    setComboOpen(false)
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      row.type === "semi" && row.ref_id === s.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
