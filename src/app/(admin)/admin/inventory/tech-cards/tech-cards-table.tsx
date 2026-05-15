"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { InventorySearch } from "@/components/admin/inventory-search"

export type TechCardsOverviewRow = {
  id: string
  name_ru: string
  componentCount: number
  costLabel: string | null
}

type Props = {
  rows: TechCardsOverviewRow[]
}

export function TechCardsOverviewTable({ rows }: Props) {
  const [search, setSearch] = useState("")

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name_ru.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <>
      <div className="mb-4 max-w-md">
        <InventorySearch
          value={search}
          onChange={setSearch}
          placeholder="Поиск по названию блюда…"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Блюдо</TableHead>
            <TableHead className="w-44 text-right tabular-nums">
              Компонентов
            </TableHead>
            <TableHead className="min-w-[8rem] text-right tabular-nums">
              Себестоимость
            </TableHead>
            <TableHead className="w-[220px] text-right">Ред.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground text-center"
              >
                Нет техкарт
              </TableCell>
            </TableRow>
          ) : filteredRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground text-center"
              >
                Ничего не найдено
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name_ru}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.componentCount}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.costLabel == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    r.costLabel
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/menu?edit=${r.id}`}>
                      Открыть в меню
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  )
}
