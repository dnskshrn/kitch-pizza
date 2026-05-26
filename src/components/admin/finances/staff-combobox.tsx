"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type StaffListItem = {
  id: string
  name: string
}

export interface StaffComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  staff: StaffListItem[]
}

function containsFilter(itemValue: string, search: string): number {
  const query = search.trim().toLowerCase()
  if (!query) return 1
  return itemValue.toLowerCase().includes(query) ? 1 : 0
}

export function StaffCombobox({
  value,
  onChange,
  placeholder = "Выберите сотрудника",
  staff,
}: StaffComboboxProps) {
  const [open, setOpen] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)

  const selectedStaff = useMemo(() => {
    return staff.find((member) => member.name === value) ?? null
  }, [staff, value])

  useEffect(() => {
    if (selectedStaff) {
      setShowManualInput(false)
      return
    }

    if (value.trim().length > 0) {
      setShowManualInput(true)
    }
  }, [selectedStaff, value])

  if (showManualInput) {
    return (
      <div className="space-y-2">
        <Input
          placeholder="Введите имя сотрудника"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 text-muted-foreground hover:text-foreground"
          onClick={() => setShowManualInput(false)}
        >
          <ArrowLeft className="mr-1 size-4" />
          Назад к списку
        </Button>
      </div>
    )
  }

  const triggerLabel =
    selectedStaff?.name ?? (value.trim().length > 0 ? value : undefined)

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !triggerLabel && "text-muted-foreground",
          )}
        >
          <span className="truncate">{triggerLabel ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command filter={containsFilter}>
          <CommandInput placeholder="Поиск сотрудника..." />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup heading="Сотрудники">
              {staff.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.name}
                  onSelect={() => {
                    onChange(member.name)
                    setShowManualInput(false)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      value === member.name ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{member.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup>
              <CommandItem
                value="Ввести вручную"
                onSelect={() => {
                  if (selectedStaff) {
                    onChange("")
                  }
                  setShowManualInput(true)
                  setOpen(false)
                }}
              >
                <span>Ввести вручную</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
