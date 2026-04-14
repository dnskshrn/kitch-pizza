"use client"

import { useState } from "react"
import type { Promotion } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Plus, Trash2 } from "lucide-react"
import Image from "next/image"
import { DeletePromotionDialog } from "./delete-promotion-dialog"
import { PromotionDialog } from "./promotion-dialog"

function PromoThumb({ url }: { url: string | null }) {
  return (
    <div
      className="relative w-[120px] overflow-hidden rounded-md bg-transparent"
      style={{ aspectRatio: "4 / 3" }}
    >
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          className="object-cover"
          sizes="120px"
        />
      ) : (
        <span className="text-muted-foreground flex h-full min-h-[90px] items-center justify-center rounded-md border border-dashed border-border text-[10px]">
          нет
        </span>
      )}
    </div>
  )
}

export function PromotionsTable({ promotions }: { promotions: Promotion[] }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editPromotion, setEditPromotion] = useState<Promotion | null>(null)
  const [deletePromotion, setDeletePromotion] = useState<Promotion | null>(
    null,
  )

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Акции</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить акцию
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Фото (RU)</TableHead>
            <TableHead className="w-[140px]">Фото (RO)</TableHead>
            <TableHead className="w-24">Порядок</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="w-28 text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {promotions.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <PromoThumb url={p.image_url_ru} />
              </TableCell>
              <TableCell>
                <PromoThumb url={p.image_url_ro} />
              </TableCell>
              <TableCell>{p.sort_order}</TableCell>
              <TableCell>
                {p.is_active ? (
                  <Badge>Активна</Badge>
                ) : (
                  <Badge variant="secondary">Скрыта</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Редактировать"
                  onClick={() => setEditPromotion(p)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Удалить"
                  onClick={() => setDeletePromotion(p)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <PromotionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        promotion={null}
      />
      <PromotionDialog
        open={!!editPromotion}
        onOpenChange={(o) => !o && setEditPromotion(null)}
        mode="edit"
        promotion={editPromotion}
      />
      <DeletePromotionDialog
        promotion={deletePromotion}
        open={!!deletePromotion}
        onOpenChange={(o) => !o && setDeletePromotion(null)}
      />
    </>
  )
}
