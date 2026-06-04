"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Camera, Loader2, X } from "lucide-react"
import { Drawer } from "vaul"
import { toast } from "sonner"

import type {
  OcrInvoiceResult,
  OcrMatchedItem,
} from "@/lib/admin/inventory/invoice-ocr-types"
import { displayUnit, type StorageUnit } from "@/lib/inventory-units"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { IngredientCombobox } from "./ingredient-combobox"
import {
  InventorySearchCombobox,
  type InventorySearchComboboxOption,
} from "../inventory-search-combobox"

export type InvoiceOcrCompletePayload = OcrInvoiceResult & {
  supplierId: string
}

export type InvoiceOcrModalIngredient = {
  id: string
  name: string
  unit: StorageUnit
}

export interface InvoiceOcrModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (payload: InvoiceOcrCompletePayload) => void
  suppliers: { id: string; name: string }[]
  ingredients: InvoiceOcrModalIngredient[]
}

type Step = "capture" | "processing" | "review" | "confirm"

const PROCESSING_MESSAGES = [
  "Читаем накладную...",
  "Извлекаем позиции...",
  "Сопоставляем с базой...",
] as const

function useIsDrawerLayout() {
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)")
    setDrawer(mq.matches)
    const handler = (e: MediaQueryListEvent) => setDrawer(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return drawer
}

function todayLocalISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatMdl(value: number): string {
  return value.toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

function parsePositiveNumber(s: string): number | null {
  const t = s.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function confidenceCardClass(
  confidence: OcrMatchedItem["confidence"]
): string {
  switch (confidence) {
    case "high":
      return "border-green-500/30 bg-green-500/5"
    case "medium":
      return "border-yellow-500/30 bg-yellow-500/5"
    default:
      return "border-red-500/30 bg-red-500/5"
  }
}

function ConfidenceBadge({ confidence }: { confidence: OcrMatchedItem["confidence"] }) {
  switch (confidence) {
    case "high":
      return (
        <Badge className="border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400">
          Высокая
        </Badge>
      )
    case "medium":
      return (
        <Badge className="border-yellow-600/30 bg-yellow-600/10 text-yellow-800 dark:text-yellow-400">
          Средняя
        </Badge>
      )
    case "low":
      return (
        <Badge className="border-orange-600/30 bg-orange-600/10 text-orange-800 dark:text-orange-400">
          Низкая
        </Badge>
      )
    default:
      return (
        <Badge variant="destructive" className="bg-red-600/10 text-red-700 dark:text-red-400">
          Не найдено
        </Badge>
      )
  }
}

function unitLabel(unit: string | null): string {
  if (!unit) return ""
  return displayUnit(unit as StorageUnit)
}

export function InvoiceOcrModal({
  open,
  onOpenChange,
  onComplete,
  suppliers,
  ingredients,
}: InvoiceOcrModalProps) {
  const isDrawer = useIsDrawerLayout()

  const [step, setStep] = useState<Step>("capture")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<OcrInvoiceResult | null>(null)
  const [editedItems, setEditedItems] = useState<OcrMatchedItem[]>([])
  const [skippedItemIds, setSkippedItemIds] = useState<Set<number>>(new Set())
  const [confirmedIndices, setConfirmedIndices] = useState<Set<number>>(new Set())
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [invoiceDate, setInvoiceDate] = useState(todayLocalISODate())
  const [isCreating, setIsCreating] = useState(false)
  const [processingMsgIndex, setProcessingMsgIndex] = useState(0)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const ocrStartedRef = useRef(false)

  const ingredientById = useMemo(() => {
    const m = new Map<string, InvoiceOcrModalIngredient>()
    for (const ing of ingredients) {
      m.set(ing.id, ing)
    }
    return m
  }, [ingredients])

  const supplierOptions: InventorySearchComboboxOption[] = useMemo(
    () => suppliers.map((s) => ({ id: s.id, name: s.name })),
    [suppliers]
  )

  const comboboxIngredients = useMemo(
    () =>
      ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        suffix: displayUnit(i.unit),
      })),
    [ingredients]
  )

  const resetState = useCallback(() => {
    setStep("capture")
    setImageFile(null)
    setPreviewUrl(null)
    setResult(null)
    setEditedItems([])
    setSkippedItemIds(new Set())
    setConfirmedIndices(new Set())
    setSelectedSupplierId(null)
    setInvoiceDate(todayLocalISODate())
    setIsCreating(false)
    setProcessingMsgIndex(0)
    ocrStartedRef.current = false
  }, [])

  useEffect(() => {
    if (!open) {
      resetState()
      return
    }
  }, [open, resetState])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileSelect = useCallback(
    (file: File | undefined) => {
      if (!file) return
      setImageFile(file)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(file)
      })
    },
    []
  )

  const clearImage = useCallback(() => {
    setImageFile(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  const startRecognize = useCallback(() => {
    if (!imageFile) return
    ocrStartedRef.current = false
    setStep("processing")
  }, [imageFile])

  useEffect(() => {
    if (step !== "processing") return
    const id = window.setInterval(() => {
      setProcessingMsgIndex((i) => (i + 1) % PROCESSING_MESSAGES.length)
    }, 3000)
    return () => window.clearInterval(id)
  }, [step])

  useEffect(() => {
    if (step !== "processing" || !imageFile) return
    if (ocrStartedRef.current) return
    ocrStartedRef.current = true

    let cancelled = false

    ;(async () => {
      try {
        const formData = new FormData()
        formData.append("image", imageFile)
        const res = await fetch("/api/admin/inventory/ocr-invoice", {
          method: "POST",
          body: formData,
        })

        if (cancelled) return

        if (!res.ok) {
          let message = "Не удалось распознать накладную"
          try {
            const data = (await res.json()) as { error?: string }
            if (data.error === "no_image") message = "Изображение не выбрано"
            else if (data.error === "ocr_parse_failed")
              message = "Не удалось прочитать накладную"
            else if (data.error === "match_parse_failed")
              message = "Не удалось сопоставить позиции"
            else if (res.status === 401) message = "Требуется вход в админку"
          } catch {
            /* ignore */
          }
          toast.error(message)
          setStep("capture")
          return
        }

        const data = (await res.json()) as OcrInvoiceResult
        if (cancelled) return

        setResult(data)
        setEditedItems(data.items)
        setSelectedSupplierId(data.matched_supplier_id)
        setInvoiceDate(data.date ?? todayLocalISODate())
        setSkippedItemIds(new Set())
        setConfirmedIndices(new Set())
        setStep("review")
      } catch {
        if (!cancelled) {
          toast.error("Ошибка сети при распознавании")
          setStep("capture")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [step, imageFile])

  const activeItemCount = useMemo(
    () =>
      editedItems.filter(
        (item, i) => !skippedItemIds.has(i) && item.matched_ingredient_id
      ).length,
    [editedItems, skippedItemIds]
  )

  const reviewBadgeCount = useMemo(
    () => editedItems.filter((_, i) => !skippedItemIds.has(i)).length,
    [editedItems, skippedItemIds]
  )

  const hasUnconfirmedHigh = useMemo(
    () =>
      editedItems.some(
        (item, i) =>
          item.confidence === "high" &&
          !skippedItemIds.has(i) &&
          !confirmedIndices.has(i)
      ),
    [editedItems, skippedItemIds, confirmedIndices]
  )

  const confirmTotalMdl = useMemo(() => {
    return editedItems.reduce((sum, item, i) => {
      if (skippedItemIds.has(i) || !item.matched_ingredient_id) return sum
      return sum + item.display_quantity * item.unit_price
    }, 0)
  }, [editedItems, skippedItemIds])

  const confirmSummaryItems = useMemo(
    () =>
      editedItems
        .map((item, i) => ({ item, index: i }))
        .filter(
          ({ item, index }) =>
            !skippedItemIds.has(index) && item.matched_ingredient_id
        ),
    [editedItems, skippedItemIds]
  )

  function patchItem(index: number, patch: Partial<OcrMatchedItem>) {
    setEditedItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  function handleIngredientChange(index: number, ingredientId: string) {
    const ing = ingredientById.get(ingredientId)
    patchItem(index, {
      matched_ingredient_id: ingredientId || null,
      matched_ingredient_name: ing?.name ?? null,
      matched_ingredient_unit: ing?.unit ?? null,
    })
  }

  function acceptAllGreen() {
    setConfirmedIndices((prev) => {
      const next = new Set(prev)
      editedItems.forEach((item, i) => {
        if (item.confidence === "high" && !skippedItemIds.has(i)) {
          next.add(i)
        }
      })
      return next
    })
  }

  function toggleSkip(index: number) {
    setSkippedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function buildCompletePayload(): InvoiceOcrCompletePayload {
    const items = editedItems
      .map((item, i) => ({ item, i }))
      .filter(({ i }) => !skippedItemIds.has(i) && editedItems[i].matched_ingredient_id)
      .map(({ item }) => item)

    return {
      supplier_name: result?.supplier_name ?? null,
      invoice_number: result?.invoice_number ?? null,
      date: invoiceDate,
      matched_supplier_id: selectedSupplierId,
      items,
      supplierId: selectedSupplierId ?? "",
    }
  }

  function handleCreate() {
    if (!selectedSupplierId) {
      toast.error("Выберите поставщика")
      return
    }
    setIsCreating(true)
    onComplete(buildCompletePayload())
  }

  const stepTitle =
    step === "capture"
      ? "Сфотографировать накладную"
      : step === "processing"
        ? "Распознавание"
        : step === "review"
          ? "Проверьте позиции"
          : "Подтверждение"

  const inner = (
    <div className="flex min-h-0 flex-1 flex-col">
      {step !== "processing" && step !== "confirm" ? (
        <div className="mb-4 flex shrink-0 items-center justify-between gap-2">
          <h2 className="text-lg font-semibold leading-tight">{stepTitle}</h2>
          {step === "review" ? (
            <Badge variant="secondary">{reviewBadgeCount} позиций</Badge>
          ) : null}
        </div>
      ) : null}

      {step === "capture" ? (
        <div className="flex flex-1 flex-col gap-4">
          {!previewUrl ? (
            <>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input bg-muted/30 text-lg font-medium transition-colors hover:bg-muted/50"
              >
                <Camera className="size-8 text-muted-foreground" aria-hidden />
                Сфотографировать
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  handleFileSelect(e.target.files?.[0])
                  e.target.value = ""
                }}
              />

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-sm text-muted-foreground">или</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="secondary"
                className="h-12 w-full text-base"
                onClick={() => galleryInputRef.current?.click()}
              >
                Загрузить из галереи
              </Button>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleFileSelect(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
            </>
          ) : (
            <div className="flex flex-col gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Превью накладной"
                className="mx-auto max-h-64 w-full rounded-xl object-contain"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={clearImage}
              >
                Изменить фото
              </Button>
              <Button
                type="button"
                className="h-12 w-full text-base"
                onClick={startRecognize}
              >
                Распознать →
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {step === "processing" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12 text-center">
          <Loader2 className="size-14 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-lg font-medium">{PROCESSING_MESSAGES[processingMsgIndex]}</p>
          <p className="text-sm text-muted-foreground">
            Обычно занимает 8–15 секунд
          </p>
        </div>
      ) : null}

      {step === "review" ? (
        <>
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-4">
            {editedItems.map((item, index) => {
              const skipped = skippedItemIds.has(index)
              return (
                <div
                  key={`${item.raw_name}-${index}`}
                  className={cn(
                    "mb-3 rounded-xl border p-4 transition-opacity",
                    confidenceCardClass(item.confidence),
                    skipped && "opacity-40"
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <ConfidenceBadge confidence={item.confidence} />
                    {skipped ? (
                      <button
                        type="button"
                        className="text-sm text-primary underline-offset-4 hover:underline"
                        onClick={() => toggleSkip(index)}
                      >
                        Восстановить
                      </button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-label="Пропустить позицию"
                        onClick={() => toggleSkip(index)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>

                  <p
                    className={cn(
                      "mb-3 text-xs text-muted-foreground",
                      skipped && "line-through"
                    )}
                  >
                    {item.raw_name}
                  </p>

                  {!skipped ? (
                    <>
                      <div className="mb-3">
                        <IngredientCombobox
                          value={item.matched_ingredient_id ?? ""}
                          onChange={(id) => handleIngredientChange(index, id)}
                          ingredients={comboboxIngredients}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="mb-1.5 text-xs text-muted-foreground">
                            Кол-во
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              className="h-10 min-h-10"
                              value={item.display_quantity}
                              onChange={(e) => {
                                const n = parsePositiveNumber(e.target.value)
                                if (n != null) {
                                  patchItem(index, { display_quantity: n })
                                }
                              }}
                            />
                            <span className="shrink-0 text-sm text-muted-foreground">
                              {item.matched_ingredient_unit === "g"
                                ? "кг"
                                : item.matched_ingredient_unit === "ml"
                                  ? "л"
                                  : "шт"}
                            </span>
                          </div>
                        </div>
                        <div>
                          <Label className="mb-1.5 text-xs text-muted-foreground">
                            Цена/ед
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              className="h-10 min-h-10"
                              value={item.unit_price}
                              onChange={(e) => {
                                const n = parsePositiveNumber(e.target.value)
                                if (n != null) {
                                  patchItem(index, { unit_price: n })
                                }
                              }}
                            />
                            <span className="shrink-0 text-sm text-muted-foreground">
                              MDL
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="sticky bottom-0 -mx-1 shrink-0 border-t bg-background px-1 pt-3 pb-1">
            <div className="flex flex-col gap-2">
              {hasUnconfirmedHigh ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full"
                  onClick={acceptAllGreen}
                >
                  Принять всё зелёное
                </Button>
              ) : null}
              <Button
                type="button"
                className="h-12 w-full text-base"
                disabled={activeItemCount === 0}
                onClick={() => setStep("confirm")}
              >
                Далее →
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {step === "confirm" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <h2 className="text-lg font-semibold">Подтверждение</h2>

          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-sm">Поставщик</Label>
                <InventorySearchCombobox
                  value={selectedSupplierId ?? ""}
                  onChange={(id) => setSelectedSupplierId(id || null)}
                  options={supplierOptions}
                  placeholder="Поставщик"
                  searchPlaceholder="Поиск поставщика…"
                  triggerClassName="h-10 min-h-10"
                />
              </div>
              <div>
                <Label htmlFor="ocr-invoice-date" className="mb-1.5 block text-sm">
                  Дата
                </Label>
                <Input
                  id="ocr-invoice-date"
                  type="date"
                  className="h-10 min-h-10"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Позиций</span>
                <span className="font-medium">{activeItemCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Итого</span>
                <span className="font-semibold">{formatMdl(confirmTotalMdl)} MDL</span>
              </div>
            </div>
          </div>

          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto text-sm">
            {confirmSummaryItems.map(({ item, index }) => (
              <li
                key={`summary-${index}`}
                className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-b border-border/60 pb-2 last:border-0"
              >
                <span className="min-w-0 flex-1 font-medium">
                  {item.matched_ingredient_name ?? item.raw_name}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {item.display_quantity} {unitLabel(item.matched_ingredient_unit)}{" "}
                  · {formatMdl(item.unit_price)} MDL
                </span>
              </li>
            ))}
          </ul>

          <div className="flex shrink-0 flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="h-10"
              disabled={isCreating}
              onClick={() => setStep("review")}
            >
              ← Назад
            </Button>
            <Button
              type="button"
              className="h-12 w-full text-base"
              disabled={isCreating || !selectedSupplierId || activeItemCount === 0}
              onClick={handleCreate}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
                  Создание…
                </>
              ) : (
                "Создать поставку"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )

  if (isDrawer) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[24px] bg-background px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-muted" />
            <Drawer.Title className="sr-only">{stepTitle}</Drawer.Title>
            {inner}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-6"
      >
        <DialogTitle className="sr-only">{stepTitle}</DialogTitle>
        {inner}
      </DialogContent>
    </Dialog>
  )
}
